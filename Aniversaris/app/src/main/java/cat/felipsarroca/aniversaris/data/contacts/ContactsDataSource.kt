package cat.felipsarroca.aniversaris.data.contacts

import cat.felipsarroca.aniversaris.domain.birthdays.ContactAccount
import cat.felipsarroca.aniversaris.domain.birthdays.RawBirthday

interface ContactsDataSource {
    suspend fun listAccounts(): List<ContactAccount>
    suspend fun readBirthdays(account: ContactAccount): List<RawBirthday>
}
