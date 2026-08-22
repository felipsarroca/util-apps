package cat.felipsarroca.aniversaris.scheduling

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import java.time.ZoneId
import java.time.ZonedDateTime

class DayChangeScheduler(private val context: Context) {
    fun hasExactAlarmAccess(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
        return alarmManager.canScheduleExactAlarms()
    }

    fun scheduleNext(now: ZonedDateTime = ZonedDateTime.now(ZoneId.systemDefault())) {
        val trigger = now.toLocalDate().plusDays(1).atStartOfDay(now.zone).plusSeconds(5)
        val operation = PendingIntent.getBroadcast(
            context,
            REQUEST_CODE,
            Intent(context, DayChangeReceiver::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        if (hasExactAlarmAccess()) {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger.toInstant().toEpochMilli(), operation)
        } else {
            alarmManager.setWindow(
                AlarmManager.RTC_WAKEUP,
                trigger.toInstant().toEpochMilli(),
                15 * 60 * 1000L,
                operation,
            )
        }
    }

    private val alarmManager get() = context.getSystemService(AlarmManager::class.java)

    private companion object { const val REQUEST_CODE = 2208 }
}
