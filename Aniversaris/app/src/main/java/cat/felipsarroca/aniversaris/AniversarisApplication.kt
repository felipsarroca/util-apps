package cat.felipsarroca.aniversaris

import android.app.Application
import cat.felipsarroca.aniversaris.scheduling.DayChangeScheduler
import cat.felipsarroca.aniversaris.scheduling.SafetyWork

class AniversarisApplication : Application() {
    val container by lazy { AppContainer(this) }

    override fun onCreate() {
        super.onCreate()
        DayChangeScheduler(this).scheduleNext()
        SafetyWork.schedule(this)
    }
}
