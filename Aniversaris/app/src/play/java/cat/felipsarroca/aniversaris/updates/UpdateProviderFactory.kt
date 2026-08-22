package cat.felipsarroca.aniversaris.updates

import android.content.Context
import cat.felipsarroca.aniversaris.BuildConfig
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.install.model.UpdateAvailability
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine

object UpdateProviderFactory {
    fun create(context: Context): UpdateProvider = PlayUpdateProvider(context.applicationContext)
}

private class PlayUpdateProvider(context: Context) : UpdateProvider {
    private val manager = AppUpdateManagerFactory.create(context)

    override suspend fun check(): UpdateCheckResult = suspendCancellableCoroutine { continuation ->
        manager.appUpdateInfo
            .addOnSuccessListener { info ->
                val result = if (info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE && info.availableVersionCode() > BuildConfig.VERSION_CODE) {
                    UpdateCheckResult.Available(AvailableUpdate(info.availableVersionCode(), "Nova versió", "market://details?id=${BuildConfig.APPLICATION_ID}"))
                } else UpdateCheckResult.UpToDate
                if (continuation.isActive) continuation.resume(result)
            }
            .addOnFailureListener { error ->
                if (continuation.isActive) continuation.resume(UpdateCheckResult.Error(error.message ?: "No s’ha pogut consultar Google Play"))
            }
    }
}
