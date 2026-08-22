package cat.felipsarroca.aniversaris.domain.birthdays

import java.time.LocalDate

data class ContactAccount(val name: String, val type: String)

data class RawBirthday(
    val sourceRowId: Long,
    val rawContactId: Long,
    val contactId: Long?,
    val lookupKey: String?,
    val displayName: String,
    val rawDate: String,
    val photoThumbnailUri: String?,
    val accountName: String,
    val accountType: String,
)

data class ParsedBirthday(
    val sourceRowIds: Set<Long>,
    val rawContactIds: Set<Long>,
    val contactIds: Set<Long>,
    val lookupKeys: Set<String>,
    val displayName: String,
    val normalizedName: String,
    val day: Int,
    val month: Int,
    val birthYear: Int?,
    val hasYearConflict: Boolean,
    val photoThumbnailUri: String?,
    val accountName: String,
    val accountType: String,
)

data class UpcomingBirthday(
    val id: String,
    val lookupKey: String?,
    val displayName: String,
    val photoThumbnailUri: String?,
    val nextDate: LocalDate,
    val daysRemaining: Long,
    val ageTurning: Int?,
)

enum class LeapDayRule { FEB_28, MAR_1 }
enum class RefreshReason { APP_OPEN, USER, ACCOUNT_CHANGED, DAY_CHANGED, PERMISSION_GRANTED }

sealed interface RefreshResult {
    data class Success(val imported: Int, val invalidRows: Int, val duplicatesRemoved: Int) : RefreshResult
    data object PermissionMissing : RefreshResult
    data object AccountMissing : RefreshResult
    data class Error(val cause: Throwable) : RefreshResult
}
