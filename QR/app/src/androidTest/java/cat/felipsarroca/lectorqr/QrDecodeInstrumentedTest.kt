package cat.felipsarroca.lectorqr

import android.graphics.BitmapFactory
import android.graphics.Rect
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import zxingcpp.BarcodeReader

@RunWith(AndroidJUnit4::class)
class QrDecodeInstrumentedTest {
    @Test fun readsCatalanQrLocally() {
        val context = InstrumentationRegistry.getInstrumentation().context
        val bitmap = context.assets.open("qr_catala.png").use { BitmapFactory.decodeStream(it) }
        val reader = BarcodeReader(BarcodeReader.Options(formats = setOf(BarcodeReader.Format.QR_CODE)))
        val found = reader.read(bitmap, Rect(0, 0, bitmap.width, bitmap.height))
        assertEquals("Hola, món! à è í ò ú ç l·l 😀", found.single().text)
        bitmap.recycle()
    }

    @Test fun readsInvertedQrLocally() {
        val context = InstrumentationRegistry.getInstrumentation().context
        val bitmap = context.assets.open("qr_invertit.png").use { BitmapFactory.decodeStream(it) }
        val reader = BarcodeReader(BarcodeReader.Options(formats = setOf(BarcodeReader.Format.QR_CODE), tryInvert = true))
        val found = reader.read(bitmap, Rect(0, 0, bitmap.width, bitmap.height))
        assertEquals("https://example.org/qr", found.single().text)
        bitmap.recycle()
    }
}
