package cat.felipsarroca.aniversaris.scheduling

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class RescheduleReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action !in ALLOWED_ACTIONS) return
        DayChangeScheduler(context).scheduleNext()
        SafetyWork.schedule(context)
    }

    private companion object {
        val ALLOWED_ACTIONS = setOf(
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED,
            android.app.AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED,
        )
    }
}
