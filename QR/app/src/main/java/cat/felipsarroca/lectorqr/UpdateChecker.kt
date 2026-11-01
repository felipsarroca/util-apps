package cat.felipsarroca.lectorqr

import android.content.Context
import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

data class Release(val version: String, val url: String)

object Versions {
    private val pattern = Regex("^v?(\\d+)\\.(\\d+)\\.(\\d+)$")
    fun qrVersion(tag: String): String? {
        if (!tag.startsWith("qr-v")) return null
        return tag.removePrefix("qr-").takeIf { pattern.matches(it) }
    }
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
    private val api = "https://api.github.com/repos/felipsarroca/util-apps/releases?per_page=100"

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
                    val releases = JSONArray(body)
                    var newest: Release? = null
                    for (index in 0 until releases.length()) {
                        val json = releases.getJSONObject(index)
                        val tag = json.optString("tag_name")
                        if (json.optBoolean("draft") || json.optBoolean("prerelease")) continue
                        val version = Versions.qrVersion(tag) ?: continue
                        val url = "https://github.com/felipsarroca/util-apps/releases/tag/$tag"
                        if (json.optString("html_url") != url || Versions.compare(version, current) == null) continue
                        if (newest == null || Versions.compare(version, newest.version)!! > 0) newest = Release(version, url)
                    }
                    preferences.edit().putLong("lastSuccess", System.currentTimeMillis()).apply()
                    if (newest == null || Versions.compare(newest.version, current)!! <= 0 ||
                        (!manual && preferences.getString("dismissed", "") == newest.version)) null
                    else newest
                } finally { connection.disconnect() }
            }
            (context as android.app.Activity).runOnUiThread { callback(result) }
        }
    }

    fun dismiss(version: String) { preferences.edit().putString("dismissed", version).apply() }
}
