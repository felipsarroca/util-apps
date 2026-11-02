package cat.felipsarroca.lectorqr

import java.net.IDN
import java.net.URI
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale

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
    val wifiHidden: Boolean = false,
    val contactPhone: String? = null,
    val contactEmail: String? = null,
    val eventStart: String? = null,
    val eventEnd: String? = null,
    val eventLocation: String? = null,
    /** Plain http: the page travels without encryption. */
    val webInsecure: Boolean = false,
    /** The domain as written in the QR when it uses non-Latin characters; [display] then holds its real form. */
    val webUnicodeHost: String? = null,
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
            val scheme = uri.scheme?.lowercase()
            if (scheme in listOf("http", "https") && uri.userInfo == null) {
                webHost(uri)?.let { (ascii, unicode) ->
                    return QrContent(raw, QrKind.WEB, "Enllaç", ascii, value, value,
                        webInsecure = scheme == "http", webUnicodeHost = unicode)
                }
            }
        } catch (_: Exception) { }
        return QrContent(raw, QrKind.TEXT, "Text", raw)
    }

    /**
     * The real (ASCII) domain, plus the written form when it differs. java.net.URI leaves the host
     * empty for internationalised names, so they are read from the authority and converted with IDN:
     * "аpple.com" with a Cyrillic "а" becomes "xn--pple-43d.com" and cannot pass for apple.com.
     */
    private fun webHost(uri: URI): Pair<String, String?>? {
        uri.host?.takeIf { it.isNotBlank() }?.let { return it.lowercase() to null }
        val authority = uri.authority?.takeIf { it.isNotBlank() && '@' !in it } ?: return null
        val host = authority.replace(Regex(":\\d{1,5}$"), "").trimEnd('.')
        if (host.isBlank() || host.any { it.isWhitespace() || it in "/\\?#[]" }) return null
        val ascii = runCatching { IDN.toASCII(host, IDN.USE_STD3_ASCII_RULES).lowercase() }.getOrNull() ?: return null
        if (ascii.isBlank() || ascii == host.lowercase()) return null
        return ascii to host
    }

    private fun wifi(raw: String, value: String): QrContent {
        val fields = splitEscaped(value.substring(5), ';').mapNotNull {
            val i = it.indexOf(':'); if (i < 1) null else it.substring(0, i).uppercase() to unescape(it.substring(i + 1))
        }.toMap()
        val ssid = fields["S"]?.takeIf { it.isNotBlank() } ?: return QrContent(raw, QrKind.TEXT, "Text", raw)
        val security = fields["T"]?.uppercase() ?: "NOPASS"
        if (security !in setOf("WPA", "WEP", "NOPASS", "SAE")) return QrContent(raw, QrKind.TEXT, "Text", raw)
        return QrContent(raw, QrKind.WIFI, "Xarxa Wi-Fi", ssid, "Contrasenya oculta", wifiSsid = ssid,
            wifiPassword = fields["P"]?.takeIf { it.isNotEmpty() }, wifiSecurity = security,
            wifiHidden = fields["H"].equals("true", ignoreCase = true))
    }

    private fun contact(raw: String, value: String): QrContent {
        val lines = if (value.startsWith("MECARD:", true)) splitEscaped(value.substring(7), ';') else value.lines()
        val fields = lines.mapNotNull {
            val i = it.indexOf(':'); if (i < 1) null else it.substring(0, i).substringBefore(';').uppercase() to unescape(it.substring(i + 1).trim())
        }.toMap()
        val name = fields["FN"] ?: fields["N"] ?: return QrContent(raw, QrKind.TEXT, "Text", raw)
        val detail = listOfNotNull(fields["TEL"], fields["EMAIL"], fields["ORG"]).joinToString("\n")
        return QrContent(raw, QrKind.CONTACT, "Contacte", name.replace(',', ' ').trim(), detail,
            contactPhone = fields["TEL"], contactEmail = fields["EMAIL"])
    }

    private fun event(raw: String, value: String): QrContent {
        val fields = value.lines().mapNotNull {
            val i = it.indexOf(':'); if (i < 1) null else it.substring(0, i).substringBefore(';').uppercase() to it.substring(i + 1).trim()
        }.toMap()
        val title = fields["SUMMARY"] ?: return QrContent(raw, QrKind.TEXT, "Text", raw)
        return QrContent(raw, QrKind.EVENT, "Esdeveniment", title,
            listOfNotNull(fields["DTSTART"], fields["LOCATION"]).joinToString("\n"),
            eventStart = fields["DTSTART"], eventEnd = fields["DTEND"], eventLocation = fields["LOCATION"])
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

/** When an event happens, ready to show in Catalan and to pass to the calendar. */
data class EventWhen(val dateLine: String, val timeLine: String?, val beginMillis: Long, val endMillis: Long?, val allDay: Boolean)

object EventDates {
    private val catalan: Locale = Locale.forLanguageTag("ca")
    private val dateTime = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss")
    private val dateOnly = DateTimeFormatter.ofPattern("yyyyMMdd")
    private val time = DateTimeFormatter.ofPattern("HH:mm")

    private fun parse(value: String?, zone: ZoneId): Pair<ZonedDateTime, Boolean>? {
        val v = value?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        return runCatching {
            when {
                v.length == 8 -> LocalDate.parse(v, dateOnly).atStartOfDay(zone) to true
                v.endsWith("Z", true) -> LocalDateTime.parse(v.dropLast(1), dateTime).atZone(ZoneOffset.UTC).withZoneSameInstant(zone) to false
                else -> LocalDateTime.parse(v, dateTime).atZone(zone) to false
            }
        }.getOrNull()
    }

    private fun longDate(d: ZonedDateTime) = DateTimeFormatter.ofLocalizedDate(FormatStyle.FULL).withLocale(catalan).format(d)
        .replaceFirstChar { it.titlecase(catalan) }

    fun describe(start: String?, end: String?, zone: ZoneId = ZoneId.systemDefault()): EventWhen? {
        val (begin, allDay) = parse(start, zone) ?: return null
        val finish = parse(end, zone)?.first?.takeIf { it.isAfter(begin) }
        val timeLine = when {
            allDay -> "Tot el dia"
            finish == null -> time.format(begin)
            finish.toLocalDate() == begin.toLocalDate() -> "${time.format(begin)} – ${time.format(finish)}"
            else -> "${time.format(begin)} – ${DateTimeFormatter.ofPattern("d MMM", catalan).format(finish)}, ${time.format(finish)}"
        }
        return EventWhen(longDate(begin), timeLine, begin.toInstant().toEpochMilli(), finish?.toInstant()?.toEpochMilli(), allDay)
    }
}
