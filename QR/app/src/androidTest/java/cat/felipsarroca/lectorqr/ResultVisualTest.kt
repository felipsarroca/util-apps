package cat.felipsarroca.lectorqr

import android.content.ContentValues
import android.content.Intent
import android.graphics.Bitmap
import android.os.Environment
import android.provider.MediaStore
import android.view.View
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/** Screenshots of the real result UI for visual review in CI. */
@RunWith(AndroidJUnit4::class)
class ResultVisualTest {
    @Test fun capturesLinkResult() = capture("resultat-enllac.png",
        "https://exemple.cat/activitats/4t-eso?tema=historia&grup=A", "Obre l'enllaç")

    @Test fun capturesWifiResult() = capture("resultat-wifi.png",
        "WIFI:T:WPA;S:Escola-Alumnes;P:clau-de-prova;;", "Copia la contrasenya")

    @Test fun capturesEventResult() = capture("resultat-esdeveniment.png",
        "BEGIN:VEVENT\nSUMMARY:Reunió de famílies de 2n d'ESO\nDTSTART:20261112T173000\nDTEND:20261112T190000\nLOCATION:Sala d'actes\nEND:VEVENT",
        "Afegeix al calendari")

    private fun capture(name: String, raw: String, expected: String) {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        // CLEAR_TASK: a fresh activity in front, never an older scanner left by another launch.
        val intent = Intent(instrumentation.targetContext, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        val activity = instrumentation.startActivitySync(intent) as MainActivity
        instrumentation.runOnMainSync {
            val show = MainActivity::class.java.getDeclaredMethod("displayResult", String::class.java)
            show.isAccessible = true
            show.invoke(activity, raw)
        }
        instrumentation.waitForIdleSync()
        Thread.sleep(1200)
        var shown = false
        instrumentation.runOnMainSync {
            val found = ArrayList<View>()
            activity.window.decorView.findViewsWithText(found, expected, View.FIND_VIEWS_WITH_TEXT)
            shown = found.isNotEmpty()
        }
        assertTrue("La pantalla de resultat no mostra «$expected»", shown)
        val screenshot = instrumentation.uiAutomation.takeScreenshot()
        val resolver = instrumentation.targetContext.contentResolver
        val values = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, name)
            put(MediaStore.Images.Media.MIME_TYPE, "image/png")
            put(MediaStore.Images.Media.RELATIVE_PATH, "${Environment.DIRECTORY_PICTURES}/LectorQR")
            put(MediaStore.Images.Media.IS_PENDING, 1)
        }
        val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)!!
        resolver.openOutputStream(uri)!!.use { assertTrue(screenshot.compress(Bitmap.CompressFormat.PNG, 100, it)) }
        values.clear(); values.put(MediaStore.Images.Media.IS_PENDING, 0)
        resolver.update(uri, values, null, null)
        screenshot.recycle()
        instrumentation.runOnMainSync { activity.finish() }
    }
}
