package cat.felipsarroca.lectorqr

import java.net.URI

enum class QrKind { WEB, TEXT, WIFI, CONTACT, PHONE, EMAIL, SMS, GEO, EVENT }

data class QrContent(
    val raw: String,
    val kind: QrKind,
    val title: String,
    val display: String,
    val detail: String? = null,
    val actionData: String? = null,
    val wifiSsid: String? = null,
    val wifiPassword: String? = null,
    val wifiSecurity: String? = null,
)

/** Pure interpretation of known QR formats. Never follows or executes encoded content. */
object QrContentParser {
    fun parse(raw: String): QrContent {
        val value = raw.trim()
        if (value.startsWith("WIFI:", true)) return wifi(raw, value)
        if (value.startsWith("BEGIN:VCARD", true) || value.startsWith("MECARD:", true)) return contact(raw, value)
        if (value.startsWith("BEGIN:VEVENT", true)) return event(raw, value)
        if (value.startsWith("tel:", true)) {
            val number = value.substringAfter(':').trim()
            if (number.matches(Regex("[+0-9() .-]{3,40}"))) return QrContent(raw, QrKind.PHONE, "Telèfon", number, actionData = "tel:$number")
        }
        if (value.startsWith("mailto:", true)) {
            val address = value.substringAfter(':').substringBefore('?')
            if (address.contains('@') && !address.contains('\n')) return QrContent(raw, QrKind.EMAIL, "Correu", address, value, value)
        }
        if (value.startsWith("sms:", true) || value.startsWith("smsto:", true)) {
            val number = value.substringAfter(':').substringBefore('?').substringBefore(':')
            if (number.matches(Regex("[+0-9() .-]{3,40}"))) return QrContent(raw, QrKind.SMS, "SMS", number, value, value)
        }
        if (value.startsWith("geo:", true)) {
            val coords = value.substringAfter(':').substringBefore('?').split(',')
            val lat = coords.getOrNull(0)?.toDoubleOrNull()
            val lon = coords.getOrNull(1)?.toDoubleOrNull()
            if (lat != null && lon != null && lat in -90.0..90.0 && lon in -180.0..180.0)
                return QrContent(raw, QrKind.GEO, "Ubicació", "${coords[0]}, ${coords[1]}", value, value)
        }
        try {
            val uri = URI(value)
            if (uri.scheme?.lowercase() in listOf("http", "https") && !uri.host.isNullOrBlank() && uri.userInfo == null) {
                val host = uri.host.lowercase()
                return QrContent(raw, QrKind.WEB, "Enllaç", host, value, value)
            }
        } catch (_: Exception) { }
        return QrContent(raw, QrKind.TEXT, "Text", raw)
    }

    private fun wifi(raw: String, value: String): QrContent {
        val fields = splitEscaped(value.substring(5), ';').mapNotNull {
            val i = it.indexOf(':'); if (i < 1) null else it.substring(0, i).uppercase() to unescape(it.substring(i + 1))
        }.toMap()
        val ssid = fields["S"]?.takeIf { it.isNotBlank() } ?: return QrContent(raw, QrKind.TEXT, "Text", raw)
        val security = fields["T"]?.uppercase() ?: "NOPASS"
        if (security !in setOf("WPA", "WEP", "NOPASS", "SAE")) return QrContent(raw, QrKind.TEXT, "Text", raw)
        return QrContent(raw, QrKind.WIFI, "Xarxa Wi-Fi", ssid, "Contrasenya oculta", wifiSsid = ssid,
            wifiPassword = fields["P"], wifiSecurity = security)
    }

    private fun contact(raw: String, value: String): QrContent {
        val lines = if (value.startsWith("MECARD:", true)) splitEscaped(value.substring(7), ';') else value.lines()
        val fields = lines.mapNotNull {
            val i = it.indexOf(':'); if (i < 1) null else it.substring(0, i).substringBefore(';').uppercase() to unescape(it.substring(i + 1).trim())
        }.toMap()
        val name = fields["FN"] ?: fields["N"] ?: return QrContent(raw, QrKind.TEXT, "Text", raw)
        val detail = listOfNotNull(fields["TEL"], fields["EMAIL"], fields["ORG"]).joinToString("\n")
        return QrContent(raw, QrKind.CONTACT, "Contacte", name.replace(',', ' ').trim(), detail)
    }

    private fun event(raw: String, value: String): QrContent {
        val fields = value.lines().mapNotNull {
            val i = it.indexOf(':'); if (i < 1) null else it.substring(0, i).substringBefore(';').uppercase() to it.substring(i + 1).trim()
        }.toMap()
        val title = fields["SUMMARY"] ?: return QrContent(raw, QrKind.TEXT, "Text", raw)
        return QrContent(raw, QrKind.EVENT, "Esdeveniment", title,
            listOfNotNull(fields["DTSTART"], fields["LOCATION"]).joinToString("\n"))
    }

    private fun splitEscaped(value: String, separator: Char): List<String> {
        val parts = mutableListOf<String>(); val current = StringBuilder(); var escaped = false
        for (ch in value) {
            when { escaped -> { current.append('\\').append(ch); escaped = false }
                ch == '\\' -> escaped = true
                ch == separator -> { parts += current.toString(); current.clear() }
                else -> current.append(ch) }
        }
        parts += current.toString(); return parts
    }

    private fun unescape(value: String): String = value.replace(Regex("\\\\([;,:\\\\])"), "$1")
}
