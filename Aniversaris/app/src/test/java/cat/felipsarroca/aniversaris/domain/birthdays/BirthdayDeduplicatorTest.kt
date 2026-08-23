package cat.felipsarroca.aniversaris.domain.birthdays

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BirthdayDeduplicatorTest {
    private fun row(
        id: Long,
        rawId: Long = id,
        contactId: Long? = 10,
        lookup: String? = "lookup",
        name: String = "Èric Sánchez",
        date: String = "2013-08-24",
        label: String? = null,
    ) = RawBirthday(
        sourceRowId = id,
        rawContactId = rawId,
        contactId = contactId,
        lookupKey = lookup,
        displayName = name,
        rawDate = date,
        eventLabel = label,
        photoThumbnailUri = null,
        accountName = "felip.sarroca@gmail.com",
        accountType = "com.google",
    )

    @Test fun `agrupa files del mateix contacte`() {
        val result = BirthdayDeduplicator.process(listOf(row(1), row(2, rawId = 20)))
        assertEquals(1, result.birthdays.size)
        assertEquals(1, result.duplicatesRemoved)
        assertEquals(setOf(1L, 20L), result.birthdays.single().rawContactIds)
    }

    @Test fun `un canvi de nom no duplica si la lookup key es estable`() {
        val result = BirthdayDeduplicator.process(listOf(row(1, name = "Èric Sánchez"), row(2, name = "Èric Sánchez González")))
        assertEquals(1, result.birthdays.size)
    }

    @Test fun `un conflicte dany amaga ledat`() {
        val result = BirthdayDeduplicator.process(listOf(row(1, date = "2012-08-24"), row(2, date = "2013-08-24")))
        assertTrue(result.birthdays.single().hasYearConflict)
        assertNull(result.birthdays.single().birthYear)
    }

    @Test fun `compta files invalides`() {
        val result = BirthdayDeduplicator.process(listOf(row(1, date = "24/08")))
        assertEquals(1, result.invalidRows)
        assertTrue(result.birthdays.isEmpty())
    }

    @Test fun `conserva dates diferents del mateix contacte`() {
        val result = BirthdayDeduplicator.process(listOf(
            row(1, date = "1980-08-22"),
            row(2, date = "--06-26", label = "Sant"),
        ))
        assertEquals(2, result.birthdays.size)
        assertEquals(setOf(null, "Sant"), result.birthdays.map { it.eventLabel }.toSet())
    }

    @Test fun `no fusiona etiquetes diferents encara que coincideixi la data`() {
        val result = BirthdayDeduplicator.process(listOf(
            row(1, date = "--06-26", label = "Sant"),
            row(2, date = "--06-26", label = "Aniversari de casament"),
        ))
        assertEquals(2, result.birthdays.size)
        assertEquals(0, result.duplicatesRemoved)
    }
}
