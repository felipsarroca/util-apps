package cat.felipsarroca.aniversaris.updates

data class AvailableUpdate(val versionCode: Int, val versionName: String, val url: String)

sealed interface UpdateCheckResult {
    data object UpToDate : UpdateCheckResult
    data object Offline : UpdateCheckResult
    data object NotConfigured : UpdateCheckResult
    data class Available(val update: AvailableUpdate) : UpdateCheckResult
    data class Error(val message: String) : UpdateCheckResult
}

interface UpdateProvider {
    suspend fun check(): UpdateCheckResult
}
