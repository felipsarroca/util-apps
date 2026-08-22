package cat.felipsarroca.aniversaris.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import kotlinx.coroutines.flow.Flow

@Dao
interface BirthdayDao {
    @Query("SELECT * FROM birthdays")
    fun observeAll(): Flow<List<BirthdayEntity>>

    @Query("SELECT * FROM birthdays")
    suspend fun getAll(): List<BirthdayEntity>

    @Query("DELETE FROM birthdays")
    suspend fun clear()

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(rows: List<BirthdayEntity>)

    @Transaction
    suspend fun replaceAll(rows: List<BirthdayEntity>) {
        clear()
        insertAll(rows)
    }
}
