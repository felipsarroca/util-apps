package cat.felipsarroca.aniversaris.updates

import android.content.Context
import cat.felipsarroca.aniversaris.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.IOException

object UpdateProviderFactory {
    fun create(context: Context): UpdateProvider = GitHubUpdateProvider()
}

private class GitHubUpdateProvider(private val client: OkHttpClient = OkHttpClient()) : UpdateProvider {
    override suspend fun check(): UpdateCheckResult = withContext(Dispatchers.IO) {
        val repository = BuildConfig.GITHUB_REPOSITORY.trim().trim('/')
        if (!repository.matches(Regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$"))) return@withContext UpdateCheckResult.NotConfigured
        val request = Request.Builder()
            .url("https://api.github.com/repos/$repository/releases?per_page=30")
            .header("Accept", "application/vnd.github+json")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .build()
        try {
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext UpdateCheckResult.Error("HTTP ${response.code}")
                val releases = org.json.JSONArray(response.body.string())
                val tagPrefix = BuildConfig.GITHUB_RELEASE_TAG_PREFIX
                val json = (0 until releases.length()).asSequence()
                    .map { releases.getJSONObject(it) }
                    .firstOrNull {
                        !it.optBoolean("draft") &&
                            !it.optBoolean("prerelease") &&
                            it.optString("tag_name").startsWith(tagPrefix)
                    } ?: return@withContext UpdateCheckResult.UpToDate
                val versionName = json.optString("tag_name").removePrefix(tagPrefix)
                val body = json.optString("body")
                val versionCode = Regex("(?im)^\\s*versionCode\\s*:\\s*(\\d+)\\s*$").find(body)?.groupValues?.get(1)?.toIntOrNull()
                    ?: return@withContext UpdateCheckResult.Error("La release no declara versionCode")
                if (versionCode <= BuildConfig.VERSION_CODE) return@withContext UpdateCheckResult.UpToDate
                val assets = json.optJSONArray("assets")
                val apkUrl = (0 until (assets?.length() ?: 0)).asSequence()
                    .map { assets!!.getJSONObject(it) }
                    .firstOrNull { it.optString("name").endsWith(".apk", ignoreCase = true) }
                    ?.optString("browser_download_url")
                UpdateCheckResult.Available(AvailableUpdate(versionCode, versionName, apkUrl ?: json.getString("html_url")))
            }
        } catch (_: IOException) {
            UpdateCheckResult.Offline
        } catch (error: Exception) {
            UpdateCheckResult.Error(error.message ?: "Resposta no vàlida")
        }
    }
}
