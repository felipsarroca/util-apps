package cat.felipsarroca.aniversaris.scheduling

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import cat.felipsarroca.aniversaris.AniversarisApplication
import cat.felipsarroca.aniversaris.domain.birthdays.RefreshReason
import cat.felipsarroca.aniversaris.domain.birthdays.RefreshResult
import cat.felipsarroca.aniversaris.widget.BirthdayWidgets
import java.util.concurrent.TimeUnit

class SafetyWork(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val app = applicationContext as AniversarisApplication
        BirthdayWidgets.updateAll(applicationContext)
        return when (app.container.repository.refresh(RefreshReason.DAY_CHANGED)) {
            is RefreshResult.Error -> Result.retry()
            else -> {
                BirthdayWidgets.updateAll(applicationContext)
                Result.success()
            }
        }
    }

    companion object {
        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<SafetyWork>(12, TimeUnit.HOURS, 2, TimeUnit.HOURS).build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                "birthday-safety-refresh",
                ExistingPeriodicWorkPolicy.UPDATE,
                request,
            )
        }
    }
}
