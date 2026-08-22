package cat.felipsarroca.aniversaris.domain.birthdays

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class BirthdayNormalizerTest {
    @Test fun `accepta data completa`() {
        assertEquals(BirthdayNormalizer.DateParts(22, 8, 1980), BirthdayNormalizer.parseDate("1980-08-22"))
    }

    @Test fun `accepta data sense any`() {
        assertEquals(BirthdayNormalizer.DateParts(22, 8, null), BirthdayNormalizer.parseDate("--08-22"))
    }

    @Test fun `rebutja dates impossibles i ambigues`() {
        assertNull(BirthdayNormalizer.parseDate("2020-02-30"))
        assertNull(BirthdayNormalizer.parseDate("22/08/1980"))
    }

    @Test fun `normalitza accents espais i majuscules`() {
        assertEquals("eric sanchez", BirthdayNormalizer.normalizeName("  Èric   SÁNCHEZ "))
    }
}
