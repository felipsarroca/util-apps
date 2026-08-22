package cat.felipsarroca.aniversaris.data

import cat.felipsarroca.aniversaris.domain.birthdays.RefreshReason
import cat.felipsarroca.aniversaris.domain.birthdays.RefreshResult
import cat.felipsarroca.aniversaris.domain.birthdays.UpcomingBirthday
import kotlinx.coroutines.flow.Flow
import java.time.LocalDate

interface BirthdayRepository {
    fun observeUpcoming(from: LocalDate): Flow<List<UpcomingBirthday>>
    suspend fun getUpcoming(from: LocalDate): List<UpcomingBirthday>
    suspend fun refresh(reason: RefreshReason): RefreshResult
    suspend fun clearSensitiveCache()
}
