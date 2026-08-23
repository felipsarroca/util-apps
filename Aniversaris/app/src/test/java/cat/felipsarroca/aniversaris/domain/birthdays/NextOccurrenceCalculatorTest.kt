package cat.felipsarroca.aniversaris.domain.birthdays

import cat.felipsarroca.aniversaris.data.local.BirthdayEntity
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate

class NextOccurrenceCalculatorTest {
    @Test fun `avui queda a zero dies`() {
        val today = LocalDate.of(2026, 8, 22)
        assertEquals(today, NextOccurrenceCalculator.nextDate(22, 8, today, LeapDayRule.FEB_28))
    }

    @Test fun `travessa correctament el canvi dany`() {
        assertEquals(LocalDate.of(2027, 1, 1), NextOccurrenceCalculator.nextDate(1, 1, LocalDate.of(2026, 12, 31), LeapDayRule.FEB_28))
    }

    @Test fun `una data triada es converteix en la nova referencia`() {
        val selectedDate = LocalDate.of(2026, 9, 15)
        assertEquals(LocalDate.of(2026, 9, 15), NextOccurrenceCalculator.nextDate(15, 9, selectedDate, LeapDayRule.FEB_28))
        assertEquals(LocalDate.of(2027, 8, 22), NextOccurrenceCalculator.nextDate(22, 8, selectedDate, LeapDayRule.FEB_28))
    }

    @Test fun `aplica les dues regles del 29 de febrer`() {
        val today = LocalDate.of(2026, 1, 1)
        assertEquals(LocalDate.of(2026, 2, 28), NextOccurrenceCalculator.nextDate(29, 2, today, LeapDayRule.FEB_28))
        assertEquals(LocalDate.of(2026, 3, 1), NextOccurrenceCalculator.nextDate(29, 2, today, LeapDayRule.MAR_1))
    }

    @Test fun `afegeix letiqueta de les altres dates al nom`() {
        val entity = BirthdayEntity(
            id = "sant-felip",
            lookupKey = "felip",
            contactId = 1,
            rawContactIds = setOf(1L),
            displayName = "Felip Sarroca i Gil",
            normalizedName = "felip sarroca i gil",
            eventLabel = "Sant",
            day = 26,
            month = 6,
            birthYear = 1980,
            hasYearConflict = false,
            photoThumbnailUri = null,
            accountName = "felip.sarroca@gmail.com",
            accountType = "com.google",
            sourceFingerprint = "test",
            updatedAtEpochMillis = 0,
        )
        val result = NextOccurrenceCalculator.calculate(entity, LocalDate.of(2026, 1, 1), LeapDayRule.FEB_28)
        assertEquals("Felip Sarroca i Gil (sant)", result?.displayName)
        assertEquals(null, result?.ageTurning)
    }
}
