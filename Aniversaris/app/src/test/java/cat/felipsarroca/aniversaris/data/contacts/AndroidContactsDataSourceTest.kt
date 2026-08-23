package cat.felipsarroca.aniversaris.data.contacts

import android.provider.ContactsContract.CommonDataKinds.Event
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AndroidContactsDataSourceTest {
    @Test fun `amaga aniversari independentment del tipus o idioma`() {
        assertNull(labelFor(Event.TYPE_BIRTHDAY, null))
        assertNull(labelFor(Event.TYPE_ANNIVERSARY, null))
        assertNull(labelFor(Event.TYPE_CUSTOM, "Aniversari"))
        assertNull(labelFor(Event.TYPE_CUSTOM, "Birthday"))
        assertNull(labelFor(Event.TYPE_OTHER, "Cumpleaños"))
    }

    @Test fun `conserva sant defuncio i altres etiquetes`() {
        assertEquals("Sant", labelFor(Event.TYPE_CUSTOM, "Sant"))
        assertEquals("Defunció", labelFor(Event.TYPE_CUSTOM, "Defunció"))
        assertEquals("altra data", labelFor(Event.TYPE_OTHER, null))
    }
}
