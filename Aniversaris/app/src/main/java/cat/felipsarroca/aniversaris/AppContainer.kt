package cat.felipsarroca.aniversaris

import android.content.Context
import cat.felipsarroca.aniversaris.data.BirthdayRepository
import cat.felipsarroca.aniversaris.data.DefaultBirthdayRepository
import cat.felipsarroca.aniversaris.data.contacts.AndroidContactsDataSource
import cat.felipsarroca.aniversaris.data.contacts.ContactsDataSource
import cat.felipsarroca.aniversaris.data.local.AppDatabase
import cat.felipsarroca.aniversaris.data.preferences.AppPreferences

class AppContainer(context: Context) {
    val preferences = AppPreferences(context)
    val database = AppDatabase.create(context)
    val contactsDataSource: ContactsDataSource = AndroidContactsDataSource(context.contentResolver)
    val repository: BirthdayRepository = DefaultBirthdayRepository(
        context,
        contactsDataSource,
        database.birthdayDao(),
        preferences,
    )
}
