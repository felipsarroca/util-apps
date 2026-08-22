package cat.felipsarroca.aniversaris.data.contacts

import android.content.ContentResolver
import android.provider.ContactsContract.CommonDataKinds.Event
import android.provider.ContactsContract.Data
import android.provider.ContactsContract.RawContacts
import cat.felipsarroca.aniversaris.domain.birthdays.ContactAccount
import cat.felipsarroca.aniversaris.domain.birthdays.RawBirthday
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class AndroidContactsDataSource(private val resolver: ContentResolver) : ContactsDataSource {
    override suspend fun listAccounts(): List<ContactAccount> = withContext(Dispatchers.IO) {
        val accounts = linkedSetOf<ContactAccount>()
        resolver.query(
            RawContacts.CONTENT_URI,
            arrayOf(RawContacts.ACCOUNT_NAME, RawContacts.ACCOUNT_TYPE),
            "${RawContacts.DELETED}=0 AND ${RawContacts.ACCOUNT_NAME} IS NOT NULL",
            null,
            "${RawContacts.ACCOUNT_NAME} COLLATE NOCASE",
        )?.use { cursor ->
            val nameIndex = cursor.getColumnIndexOrThrow(RawContacts.ACCOUNT_NAME)
            val typeIndex = cursor.getColumnIndexOrThrow(RawContacts.ACCOUNT_TYPE)
            while (cursor.moveToNext()) {
                val name = cursor.getString(nameIndex) ?: continue
                val type = cursor.getString(typeIndex) ?: continue
                accounts += ContactAccount(name, type)
            }
        }
        accounts.toList()
    }

    override suspend fun readBirthdays(account: ContactAccount): List<RawBirthday> = withContext(Dispatchers.IO) {
        val rawIds = mutableListOf<Long>()
        resolver.query(
            RawContacts.CONTENT_URI,
            arrayOf(RawContacts._ID),
            "${RawContacts.ACCOUNT_NAME}=? AND ${RawContacts.ACCOUNT_TYPE}=? AND ${RawContacts.DELETED}=0",
            arrayOf(account.name, account.type),
            null,
        )?.use { cursor -> while (cursor.moveToNext()) rawIds += cursor.getLong(0) }
        if (rawIds.isEmpty()) return@withContext emptyList()

        val result = mutableListOf<RawBirthday>()
        rawIds.chunked(800).forEach { ids ->
            val placeholders = ids.joinToString(",") { "?" }
            val selection = "${Data.RAW_CONTACT_ID} IN ($placeholders) AND ${Data.MIMETYPE}=? AND ${Event.TYPE}=?"
            val args = ids.map(Long::toString).toMutableList().apply {
                add(Event.CONTENT_ITEM_TYPE)
                add(Event.TYPE_BIRTHDAY.toString())
            }.toTypedArray()
            resolver.query(Data.CONTENT_URI, PROJECTION, selection, args, null)?.use { cursor ->
                while (cursor.moveToNext()) {
                    result += RawBirthday(
                        sourceRowId = cursor.getLong(0),
                        rawContactId = cursor.getLong(1),
                        contactId = cursor.getLong(2).takeUnless { cursor.isNull(2) },
                        lookupKey = cursor.getString(3),
                        displayName = cursor.getString(4)?.ifBlank { "Sense nom" } ?: "Sense nom",
                        rawDate = cursor.getString(5) ?: continue,
                        photoThumbnailUri = cursor.getString(6),
                        accountName = account.name,
                        accountType = account.type,
                    )
                }
            }
        }
        result
    }

    private companion object {
        val PROJECTION = arrayOf(
            Data._ID,
            Data.RAW_CONTACT_ID,
            Data.CONTACT_ID,
            Data.LOOKUP_KEY,
            Data.DISPLAY_NAME,
            Event.START_DATE,
            Data.PHOTO_THUMBNAIL_URI,
        )
    }
}
