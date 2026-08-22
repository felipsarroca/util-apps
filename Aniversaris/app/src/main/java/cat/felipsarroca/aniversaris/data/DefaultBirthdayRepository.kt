package cat.felipsarroca.aniversaris.data

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import cat.felipsarroca.aniversaris.data.contacts.ContactsDataSource
import cat.felipsarroca.aniversaris.data.local.BirthdayDao
import cat.felipsarroca.aniversaris.data.local.BirthdayEntity
import cat.felipsarroca.aniversaris.data.preferences.AppPreferences
import cat.felipsarroca.aniversaris.domain.birthdays.BirthdayDeduplicator
import cat.felipsarroca.aniversaris.domain.birthdays.NextOccurrenceCalculator
import cat.felipsarroca.aniversaris.domain.birthdays.RefreshReason
import cat.felipsarroca.aniversaris.domain.birthdays.RefreshResult
import cat.felipsarroca.aniversaris.domain.birthdays.UpcomingBirthday
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import java.security.MessageDigest
import java.time.LocalDate

class DefaultBirthdayRepository(
    private val context: Context,
    private val contacts: ContactsDataSource,
    private val dao: BirthdayDao,
    private val preferences: AppPreferences,
) : BirthdayRepository {
    override fun observeUpcoming(from: LocalDate): Flow<List<UpcomingBirthday>> =
        combine(dao.observeAll(), preferences.values) { rows, prefs ->
            rows.mapNotNull { NextOccurrenceCalculator.calculate(it, from, prefs.leapDayRule) }
                .sortedWith(compareBy<UpcomingBirthday> { it.nextDate }.thenBy { it.displayName.lowercase() })
        }

    override suspend fun getUpcoming(from: LocalDate): List<UpcomingBirthday> {
        val prefs = preferences.current()
        return dao.getAll().mapNotNull { NextOccurrenceCalculator.calculate(it, from, prefs.leapDayRule) }
            .sortedWith(compareBy<UpcomingBirthday> { it.nextDate }.thenBy { it.displayName.lowercase() })
    }

    override suspend fun refresh(reason: RefreshReason): RefreshResult {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
            clearSensitiveCache()
            return RefreshResult.PermissionMissing
        }
        val account = preferences.current().selectedAccount ?: return RefreshResult.AccountMissing
        return try {
            val raw = contacts.readBirthdays(account)
            val processed = BirthdayDeduplicator.process(raw)
            val now = System.currentTimeMillis()
            val entities = processed.birthdays.map { item ->
                val stableParts = (item.lookupKeys.ifEmpty { item.rawContactIds.map(Long::toString).toSet() }).sorted()
                val stableId = sha256((stableParts + "${item.month}-${item.day}").joinToString("|"))
                BirthdayEntity(
                    id = stableId,
                    lookupKey = item.lookupKeys.sorted().firstOrNull(),
                    contactId = item.contactIds.minOrNull(),
                    rawContactIds = item.rawContactIds,
                    displayName = item.displayName,
                    normalizedName = item.normalizedName,
                    day = item.day,
                    month = item.month,
                    birthYear = item.birthYear,
                    hasYearConflict = item.hasYearConflict,
                    photoThumbnailUri = item.photoThumbnailUri,
                    accountName = item.accountName,
                    accountType = item.accountType,
                    sourceFingerprint = sha256(item.sourceRowIds.sorted().joinToString(",")),
                    updatedAtEpochMillis = now,
                )
            }
            dao.replaceAll(entities)
            preferences.setLastRefresh(now)
            RefreshResult.Success(entities.size, processed.invalidRows, processed.duplicatesRemoved)
        } catch (security: SecurityException) {
            clearSensitiveCache()
            RefreshResult.PermissionMissing
        } catch (error: Throwable) {
            RefreshResult.Error(error)
        }
    }

    override suspend fun clearSensitiveCache() = dao.clear()

    private fun sha256(value: String): String = MessageDigest.getInstance("SHA-256")
        .digest(value.toByteArray())
        .joinToString("") { "%02x".format(it) }
}
