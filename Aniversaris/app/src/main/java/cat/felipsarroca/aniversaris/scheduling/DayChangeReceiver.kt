package cat.felipsarroca.aniversaris.scheduling

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import cat.felipsarroca.aniversaris.AniversarisApplication
import cat.felipsarroca.aniversaris.domain.birthdays.RefreshReason
import cat.felipsarroca.aniversaris.widget.BirthdayWidgets
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class DayChangeReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val pending = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                BirthdayWidgets.updateAll(context)
                val app = context.applicationContext as AniversarisApplication
                app.container.repository.refresh(RefreshReason.DAY_CHANGED)
                BirthdayWidgets.updateAll(context)
                DayChangeScheduler(context).scheduleNext()
            } finally {
                pending.finish()
            }
        }
    }
}
