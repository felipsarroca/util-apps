package cat.felipsarroca.lectorqr

import android.content.Intent
import android.graphics.Bitmap
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.io.FileOutputStream
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/** Screenshot of the real result UI for visual review in CI. */
@RunWith(AndroidJUnit4::class)
class ResultVisualTest {
    @Test fun capturesLinkResult() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val intent = Intent(instrumentation.targetContext, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        val activity = instrumentation.startActivitySync(intent) as MainActivity
        instrumentation.runOnMainSync {
            val show = MainActivity::class.java.getDeclaredMethod("displayResult", String::class.java)
            show.isAccessible = true
            show.invoke(activity, "https://exemple.cat/activitats/4t-eso?tema=historia&grup=A")
        }
        instrumentation.waitForIdleSync()
        val screenshot = instrumentation.uiAutomation.takeScreenshot()
        val file = File(activity.filesDir, "resultat-enllac.png")
        FileOutputStream(file).use { screenshot.compress(Bitmap.CompressFormat.PNG, 100, it) }
        screenshot.recycle()
        assertTrue(file.isFile && file.length() > 0)
        instrumentation.runOnMainSync { activity.finish() }
    }
}
