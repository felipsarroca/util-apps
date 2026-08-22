package cat.felipsarroca.aniversaris.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "birthdays")
data class BirthdayEntity(
    @PrimaryKey val id: String,
    val lookupKey: String?,
    val contactId: Long?,
    val rawContactIds: Set<Long>,
    val displayName: String,
    val normalizedName: String,
    val day: Int,
    val month: Int,
    val birthYear: Int?,
    val hasYearConflict: Boolean,
    val photoThumbnailUri: String?,
    val accountName: String,
    val accountType: String,
    val sourceFingerprint: String,
    val updatedAtEpochMillis: Long,
)
