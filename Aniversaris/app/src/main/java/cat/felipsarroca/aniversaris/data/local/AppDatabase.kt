package cat.felipsarroca.aniversaris.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverter
import androidx.room.TypeConverters
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

class SetConverters {
    @TypeConverter fun fromLongSet(value: Set<Long>): String = value.sorted().joinToString(",")
    @TypeConverter fun toLongSet(value: String): Set<Long> = value.split(',').mapNotNull(String::toLongOrNull).toSet()
}

@Database(entities = [BirthdayEntity::class], version = 2, exportSchema = true)
@TypeConverters(SetConverters::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun birthdayDao(): BirthdayDao

    companion object {
        fun create(context: Context): AppDatabase = Room.databaseBuilder(
            context.applicationContext,
            AppDatabase::class.java,
            "aniversaris.db",
        ).addMigrations(MIGRATION_1_2).build()

        private val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE birthdays ADD COLUMN eventLabel TEXT")
            }
        }
    }
}
