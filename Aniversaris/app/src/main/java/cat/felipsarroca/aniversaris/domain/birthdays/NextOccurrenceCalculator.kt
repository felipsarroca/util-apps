package cat.felipsarroca.aniversaris.domain.birthdays

import java.time.DateTimeException
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.temporal.ChronoUnit

interface ClockProvider { fun now(): ZonedDateTime }

class SystemClockProvider : ClockProvider {
    override fun now(): ZonedDateTime = ZonedDateTime.now(ZoneId.systemDefault())
}

object NextOccurrenceCalculator {
    fun nextDate(day: Int, month: Int, today: LocalDate, leapRule: LeapDayRule): LocalDate? {
        fun inYear(year: Int): LocalDate? = try {
            LocalDate.of(year, month, day)
        } catch (_: DateTimeException) {
            if (month == 2 && day == 29) {
                if (leapRule == LeapDayRule.FEB_28) LocalDate.of(year, 2, 28) else LocalDate.of(year, 3, 1)
            } else null
        }
        val thisYear = inYear(today.year) ?: return null
        return if (thisYear < today) inYear(today.year + 1) else thisYear
    }

    fun calculate(entity: cat.felipsarroca.aniversaris.data.local.BirthdayEntity, today: LocalDate, leapRule: LeapDayRule): UpcomingBirthday? {
        val next = nextDate(entity.day, entity.month, today, leapRule) ?: return null
        return UpcomingBirthday(
            id = entity.id,
            lookupKey = entity.lookupKey,
            displayName = entity.displayName,
            photoThumbnailUri = entity.photoThumbnailUri,
            nextDate = next,
            daysRemaining = ChronoUnit.DAYS.between(today, next),
            ageTurning = entity.birthYear?.takeUnless { entity.hasYearConflict }?.let { next.year - it },
        )
    }
}
