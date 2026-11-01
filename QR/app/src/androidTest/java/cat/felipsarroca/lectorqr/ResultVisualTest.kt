package cat.felipsarroca.lectorqr

import android.content.Intent
import android.content.ContentValues
import android.graphics.Bitmap
import android.os.Environment
import android.provider.MediaStore
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
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
        val resolver = instrumentation.targetContext.contentResolver
        val values = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, "resultat-enllac.png")
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
