package cat.felipsarroca.lectorqr

import android.content.Context
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

data class Release(val version: String, val url: String)

object Versions {
    private val pattern = Regex("^v?(\\d+)\\.(\\d+)\\.(\\d+)$")
    fun compare(a: String, b: String): Int? {
        val left = pattern.matchEntire(a)?.groupValues?.drop(1)?.map { it.toLongOrNull() ?: return null } ?: return null
        val right = pattern.matchEntire(b)?.groupValues?.drop(1)?.map { it.toLongOrNull() ?: return null } ?: return null
        for (i in 0..2) if (left[i] != right[i]) return left[i].compareTo(right[i])
        return 0
    }
}

class UpdateChecker(private val context: Context) {
    private val executor = Executors.newSingleThreadExecutor()
    private val preferences = context.getSharedPreferences("updates", Context.MODE_PRIVATE)
    private val api = "https://api.github.com/repos/felipsarroca/lector-qr-android/releases/latest"

    fun check(manual: Boolean, current: String, callback: (Result<Release?>) -> Unit) {
        val now = System.currentTimeMillis()
        if (!manual && now - preferences.getLong("lastSuccess", 0) < 7L * 24 * 60 * 60 * 1000) return
        executor.execute {
            val result = runCatching {
                val connection = (URL(api).openConnection() as HttpURLConnection).apply {
                    connectTimeout = 5000; readTimeout = 5000
                    setRequestProperty("Accept", "application/vnd.github+json")
                    setRequestProperty("User-Agent", "LectorQR-Android")
                }
                try {
                    if (connection.responseCode != 200) error("HTTP ${connection.responseCode}")
                    val body = connection.inputStream.bufferedReader().use { it.readText() }
                    val json = JSONObject(body)
                    if (json.optBoolean("draft") || json.optBoolean("prerelease")) error("No stable release")
                    val version = json.optString("tag_name")
                    val expected = "https://github.com/felipsarroca/lector-qr-android/releases/tag/$version"
                    if (json.optString("html_url") != expected || Versions.compare(version, current) == null) error("Invalid release")
                    preferences.edit().putLong("lastSuccess", System.currentTimeMillis()).apply()
                    if (Versions.compare(version, current)!! <= 0 || (!manual && preferences.getString("dismissed", "") == version)) null
                    else Release(version, expected)
                } finally { connection.disconnect() }
            }
            (context as android.app.Activity).runOnUiThread { callback(result) }
        }
    }

    fun dismiss(version: String) { preferences.edit().putString("dismissed", version).apply() }
}
