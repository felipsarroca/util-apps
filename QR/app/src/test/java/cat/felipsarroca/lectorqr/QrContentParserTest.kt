package cat.felipsarroca.lectorqr

import org.junit.Assert.*
import org.junit.Test

class QrContentParserTest {
    @Test fun recognizesCommonTypes() {
        assertEquals(QrKind.WEB, QrContentParser.parse("https://example.org/a").kind)
        assertEquals(QrKind.WIFI, QrContentParser.parse("WIFI:T:WPA;S:Escola;P:clau;;").kind)
        assertEquals(QrKind.CONTACT, QrContentParser.parse("BEGIN:VCARD\nFN:Anna Puig\nEND:VCARD").kind)
        assertEquals(QrKind.PHONE, QrContentParser.parse("tel:+34600111222").kind)
        assertEquals(QrKind.EMAIL, QrContentParser.parse("mailto:anna@example.org").kind)
        assertEquals(QrKind.SMS, QrContentParser.parse("smsto:+34600111222:Hola").kind)
        assertEquals(QrKind.GEO, QrContentParser.parse("geo:41.5,2.1").kind)
        assertEquals(QrKind.EVENT, QrContentParser.parse("BEGIN:VEVENT\nSUMMARY:Reunió\nEND:VEVENT").kind)
    }

    @Test fun keepsUnsafeSchemesAsText() {
        for (raw in listOf("javascript:alert(1)", "intent://evil", "file:///secret", "https://user:pass@example.org"))
            assertEquals(QrKind.TEXT, QrContentParser.parse(raw).kind)
    }

    @Test fun preservesCatalanAndEscapedWifi() {
        val raw = "WIFI:T:WPA;S:Escola\\; Nord;P:clau\\:123;;"
        val parsed = QrContentParser.parse(raw)
        assertEquals("Escola; Nord", parsed.wifiSsid)
        assertEquals("clau:123", parsed.wifiPassword)
        assertEquals("à è í ò ú ç l·l 😀", QrContentParser.parse("à è í ò ú ç l·l 😀").display)
    }

    @Test fun describesEventDatesInCatalan() {
        val zone = java.time.ZoneId.of("Europe/Madrid")
        val event = EventDates.describe("20261112T173000", "20261112T190000", zone)!!
        assertTrue(event.dateLine, event.dateLine.startsWith("Dijous"))
        assertTrue(event.dateLine, event.dateLine.contains("12") && event.dateLine.contains("novembre") && event.dateLine.contains("2026"))
        assertEquals("17:30 – 19:00", event.timeLine)
        assertEquals("Tot el dia", EventDates.describe("20261112", null, zone)!!.timeLine)
        assertEquals("18:30", EventDates.describe("20261112T173000Z", null, zone)!!.timeLine)
        assertNull(EventDates.describe("dimarts", null, zone))
    }

    @Test fun readsWifiExtrasAndEventEnd() {
        val wifi = QrContentParser.parse("WIFI:T:WPA;S:Amagada;P:clau1234;H:true;;")
        assertTrue(wifi.wifiHidden)
        assertNull(QrContentParser.parse("WIFI:T:nopass;S:Oberta;P:;;").wifiPassword)
        val event = QrContentParser.parse("BEGIN:VEVENT
SUMMARY:Reunió
DTSTART:20261112T173000
DTEND:20261112T190000
END:VEVENT")
        assertEquals("20261112T190000", event.eventEnd)
    }
}
