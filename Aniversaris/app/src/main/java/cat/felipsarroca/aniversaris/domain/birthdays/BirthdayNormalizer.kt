package cat.felipsarroca.aniversaris.domain.birthdays

import java.text.Normalizer
import java.time.DateTimeException
import java.time.LocalDate
import java.util.Locale

object BirthdayNormalizer {
    private val fullDate = Regex("^(\\d{4})-(\\d{2})-(\\d{2})$")
    private val monthDay = Regex("^--(\\d{2})-(\\d{2})$")

    data class DateParts(val day: Int, val month: Int, val year: Int?)

    fun parseDate(value: String): DateParts? {
        val clean = value.trim()
        val match = fullDate.matchEntire(clean) ?: monthDay.matchEntire(clean)
        val parts = match?.groupValues ?: return null
        val hasYear = !clean.startsWith("--")
        val year = if (hasYear) parts[1].toIntOrNull() else null
        val month = parts[if (hasYear) 2 else 1].toIntOrNull() ?: return null
        val day = parts[if (hasYear) 3 else 2].toIntOrNull() ?: return null
        if (year != null && (year < 1900 || year > LocalDate.now().year)) return null
        return try {
            LocalDate.of(year ?: 2000, month, day)
            DateParts(day, month, year)
        } catch (_: DateTimeException) {
            null
        }
    }

    fun normalizeSpaces(value: String): String = value.trim().replace(Regex("\\s+"), " ")

    fun normalizeName(value: String): String {
        val lower = normalizeSpaces(value).lowercase(Locale.ROOT)
        return Normalizer.normalize(lower, Normalizer.Form.NFD)
            .replace(Regex("\\p{M}+"), "")
    }
}
