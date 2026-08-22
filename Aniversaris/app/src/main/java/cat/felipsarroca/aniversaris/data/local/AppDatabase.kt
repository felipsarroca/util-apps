package cat.felipsarroca.aniversaris.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverter
import androidx.room.TypeConverters

class SetConverters {
    @TypeConverter fun fromLongSet(value: Set<Long>): String = value.sorted().joinToString(",")
    @TypeConverter fun toLongSet(value: String): Set<Long> = value.split(',').mapNotNull(String::toLongOrNull).toSet()
}

@Database(entities = [BirthdayEntity::class], version = 1, exportSchema = true)
@TypeConverters(SetConverters::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun birthdayDao(): BirthdayDao

    companion object {
        fun create(context: Context): AppDatabase = Room.databaseBuilder(
            context.applicationContext,
            AppDatabase::class.java,
            "aniversaris.db",
        ).build()
    }
}
