package cat.felipsarroca.aniversaris.domain.birthdays

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BirthdayDeduplicatorTest {
    private fun row(id: Long, rawId: Long = id, contactId: Long? = 10, lookup: String? = "lookup", name: String = "Èric Sánchez", date: String = "2013-08-24") = RawBirthday(
        id, rawId, contactId, lookup, name, date, null, "felip.sarroca@gmail.com", "com.google",
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
}
