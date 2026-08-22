package cat.felipsarroca.aniversaris.domain.birthdays

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

    @Test fun `aplica les dues regles del 29 de febrer`() {
        val today = LocalDate.of(2026, 1, 1)
        assertEquals(LocalDate.of(2026, 2, 28), NextOccurrenceCalculator.nextDate(29, 2, today, LeapDayRule.FEB_28))
        assertEquals(LocalDate.of(2026, 3, 1), NextOccurrenceCalculator.nextDate(29, 2, today, LeapDayRule.MAR_1))
    }
}
