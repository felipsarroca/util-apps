package cat.felipsarroca.lectorqr

import android.Manifest
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.BitmapFactory
import android.content.res.ColorStateList
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.CalendarContract
import android.provider.ContactsContract
import android.provider.Settings
import android.view.Gravity
import android.view.MenuItem
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.PopupMenu
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import zxingcpp.BarcodeReader

class MainActivity : ComponentActivity() {
    private val cameraExecutor = Executors.newSingleThreadExecutor()
    private val imageExecutor = Executors.newSingleThreadExecutor()
    private val reader by lazy {
        BarcodeReader(BarcodeReader.Options(
            formats = setOf(BarcodeReader.Format.QR_CODE, BarcodeReader.Format.MICRO_QR_CODE, BarcodeReader.Format.RMQR_CODE),
            tryRotate = true, tryInvert = true, tryHarder = true
        ))
    }
    private val scanning = AtomicBoolean(false)
    private var result: QrContent? = null
    private var camera: Camera? = null
    private var provider: ProcessCameraProvider? = null
    private var torch = false
    private var pickerOpen = false
    private var pendingRelease: Release? = null
    private var cameraPermissionAtLastRender = false
    private lateinit var root: FrameLayout
    private lateinit var updateChecker: UpdateChecker

    private val permission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { showScanner() }
    private val picker = registerForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        pickerOpen = false
        if (uri == null) { scanning.set(result == null); return@registerForActivityResult }
        scanning.set(false)
        imageExecutor.execute {
            val value = runCatching {
                contentResolver.openInputStream(uri)?.use { stream ->
                    val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                    BitmapFactory.decodeStream(stream, null, options)
                    if (options.outWidth <= 0 || options.outHeight <= 0) return@use null
                    val factor = maxOf(1, maxOf(options.outWidth, options.outHeight) / 3000)
                    contentResolver.openInputStream(uri)?.use { second ->
                        val bitmap = BitmapFactory.decodeStream(second, null, BitmapFactory.Options().apply { inSampleSize = factor })
                        bitmap?.let { image -> try { pickResult(reader.read(image, Rect(0, 0, image.width, image.height)), image.width, image.height) } finally { image.recycle() } }
                    }
                }
            }.getOrNull()
            runOnUiThread {
                if (value != null) displayResult(value) else {
                    scanning.set(true)
                    toast("No s'ha trobat cap codi QR a la imatge")
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        updateChecker = UpdateChecker(this)
        root = FrameLayout(this)
        root.setBackgroundColor(Color.rgb(17, 26, 24))
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }
        setContentView(root)
        showScanner()
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED &&
            !getPreferences(MODE_PRIVATE).getBoolean("cameraAsked", false)) {
            getPreferences(MODE_PRIVATE).edit().putBoolean("cameraAsked", true).apply()
            permission.launch(Manifest.permission.CAMERA)
        }
        updateChecker.check(false, BuildConfig.VERSION_NAME) { response -> response.getOrNull()?.let { showUpdate(it) } }
    }

    override fun onResume() {
        super.onResume()
        if (result == null && !pickerOpen && ::root.isInitialized) {
            val allowed = ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
            if (allowed != cameraPermissionAtLastRender) showScanner() else scanning.set(true)
        }
    }
    override fun onPause() { scanning.set(false); camera?.cameraControl?.enableTorch(false); torch = false; super.onPause() }
    override fun onDestroy() { provider?.unbindAll(); cameraExecutor.shutdown(); imageExecutor.shutdown(); super.onDestroy() }

    private fun showScanner() {
        result = null; camera = null; root.removeAllViews()
        val main = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(Color.rgb(17, 26, 24)) }
        root.addView(main, FrameLayout.LayoutParams(-1, -1))
        val top = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; setPadding(dp(20), 0, dp(8), 0) }
        main.addView(top, LinearLayout.LayoutParams(-1, dp(60)))
        top.addView(label("Lector QR", 21f, Color.WHITE).apply { setTypeface(null, 1) }, LinearLayout.LayoutParams(0, -2, 1f))
        top.addView(iconButton("⋮", "Menú") { anchor -> menu(anchor) }, LinearLayout.LayoutParams(dp(52), dp(52)))
        val area = FrameLayout(this)
        main.addView(area, LinearLayout.LayoutParams(-1, 0, 1f))
        val cameraAllowed = ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        cameraPermissionAtLastRender = cameraAllowed
        if (cameraAllowed) {
            val preview = PreviewView(this).apply { scaleType = PreviewView.ScaleType.FILL_CENTER }
            area.addView(preview, FrameLayout.LayoutParams(-1, -1))
            area.addView(CornerOverlay(this), FrameLayout.LayoutParams(-1, -1))
            startCamera(preview)
        } else {
            val message = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER; setPadding(dp(30), 0, dp(30), 0) }
            area.addView(message, FrameLayout.LayoutParams(-1, -1))
            message.addView(label("Cal permetre l'accés a la càmera per escanejar codis QR. També pots llegir una fotografia.", 18f, Color.WHITE))
            message.addView(actionButton("Permet accedir a la càmera") { permission.launch(Manifest.permission.CAMERA) })
            if (!shouldShowRequestPermissionRationale(Manifest.permission.CAMERA))
                message.addView(actionButton("Obre els ajustaments d'Android") {
                    safeStart(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName")))
                })
        }
        val footer = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER; setPadding(0, dp(8), 0, dp(12)) }
        main.addView(footer, LinearLayout.LayoutParams(-1, dp(120)))
        footer.addView(label("Apunta la càmera a un codi QR", 16f, Color.WHITE).apply { gravity = Gravity.CENTER })
        val controls = LinearLayout(this).apply { gravity = Gravity.CENTER }
        footer.addView(controls)
        controls.addView(iconButton("⚡", "Activa o desactiva la llanterna") {
            val c = camera
            if (c?.cameraInfo?.hasFlashUnit() == true) { torch = !torch; c.cameraControl.enableTorch(torch) }
            else toast("Aquest dispositiu no té llanterna disponible")
        }, LinearLayout.LayoutParams(dp(72), dp(64)))
        controls.addView(ImageButton(this).apply {
            setImageResource(android.R.drawable.ic_menu_gallery)
            imageTintList = ColorStateList.valueOf(Color.WHITE)
            contentDescription = "Llegeix un QR d'una fotografia"
            setBackgroundColor(Color.TRANSPARENT)
            setOnClickListener {
            pickerOpen = true; scanning.set(false)
            picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
            }
        }, LinearLayout.LayoutParams(dp(72), dp(64)))
        pendingRelease?.let { release -> pendingRelease = null; showUpdate(release) }
    }

    private fun startCamera(previewView: PreviewView) {
        val future = ProcessCameraProvider.getInstance(this)
        future.addListener({
            if (result != null || isDestroyed) return@addListener
            try {
                val p = future.get(); provider = p; p.unbindAll()
                val preview = Preview.Builder().build().also { it.surfaceProvider = previewView.surfaceProvider }
                val analysis = ImageAnalysis.Builder().setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST).build()
                analysis.setAnalyzer(cameraExecutor) { image ->
                    try {
                        if (scanning.get() && !pickerOpen) {
                            val found = pickResult(reader.read(image), image.width, image.height)
                            if (found != null && scanning.compareAndSet(true, false)) runOnUiThread { displayResult(found) }
                        }
                    } catch (_: Exception) { /* A malformed frame must not stop the camera. */ }
                    finally { image.close() }
                }
                camera = p.bindToLifecycle(this, CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis)
                scanning.set(true)
            } catch (_: Exception) { showCameraError() }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun pickResult(values: List<BarcodeReader.Result>, width: Int, height: Int): String? = values
        .filter { !it.text.isNullOrEmpty() && it.format in setOf(BarcodeReader.Format.QR_CODE, BarcodeReader.Format.MICRO_QR_CODE, BarcodeReader.Format.RMQR_CODE) }
        .minByOrNull { r ->
            val p = r.position
            val x = (p.topLeft.x + p.bottomRight.x) / 2.0
            val y = (p.topLeft.y + p.bottomRight.y) / 2.0
            (x - width / 2) * (x - width / 2) + (y - height / 2) * (y - height / 2)
        }?.text

    private fun showCameraError() {
        scanning.set(false)
        toast("No s'ha pogut obrir la càmera. Pots llegir un QR d'una fotografia.")
    }

    private fun displayResult(raw: String) {
        if (result != null) return
        val item = QrContentParser.parse(raw); result = item; scanning.set(false); provider?.unbindAll(); camera = null
        root.removeAllViews()
        val layout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(Color.rgb(250, 251, 249)) }
        root.addView(layout, FrameLayout.LayoutParams(-1, -1))
        layout.addView(label(item.title, 23f, Color.rgb(17, 43, 35)).apply { setTypeface(null, 1); setPadding(dp(24), dp(20), dp(24), dp(12)) })
        val scroll = ScrollView(this).apply { isFillViewport = true }
        layout.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        val body = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(24), dp(12), dp(24), dp(16)) }
        scroll.addView(body)
        body.addView(label(item.display, 21f, Color.BLACK).apply { setTextIsSelectable(true) })
        item.detail?.takeIf { it.isNotBlank() }?.let { body.addView(label(it, 16f, Color.DKGRAY).apply { setPadding(0, dp(12), 0, 0); setTextIsSelectable(true) }) }
        if (item.kind == QrKind.WIFI && item.wifiPassword != null) {
            val password = label("Contrasenya: ••••••••", 16f, Color.DKGRAY)
            body.addView(password)
            body.addView(actionButton("Mostra la contrasenya") { password.text = "Contrasenya: ${item.wifiPassword}" })
        }
        val actions = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(24), dp(8), dp(24), dp(16)) }
        layout.addView(actions)
        primaryAction(item)?.let { (name, intent) -> actions.addView(actionButton(name) { safeStart(intent) }) }
        if (item.kind in setOf(QrKind.WEB, QrKind.TEXT, QrKind.CONTACT, QrKind.EVENT))
            actions.addView(actionButton("Comparteix") { share(item.raw) })
        actions.addView(actionButton("Copia") {
            (getSystemService(CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("Codi QR", item.raw))
            toast("Contingut copiat")
        })
        actions.addView(actionButton("Escaneja un altre QR") { showScanner() })
    }

    private fun primaryAction(item: QrContent): Pair<String, Intent>? = when (item.kind) {
        QrKind.WEB -> "Obre l'enllaç" to Intent(Intent.ACTION_VIEW, Uri.parse(item.actionData))
        QrKind.PHONE -> "Obre el marcador" to Intent(Intent.ACTION_DIAL, Uri.parse(item.actionData))
        QrKind.EMAIL -> "Prepara un correu" to Intent(Intent.ACTION_SENDTO, Uri.parse(item.actionData))
        QrKind.SMS -> "Prepara un SMS" to Intent(Intent.ACTION_SENDTO, Uri.parse(item.actionData))
        QrKind.GEO -> "Obre al mapa" to Intent(Intent.ACTION_VIEW, Uri.parse(item.actionData))
        QrKind.WIFI -> "Obre els ajustaments Wi-Fi" to Intent(if (Build.VERSION.SDK_INT >= 29) Settings.Panel.ACTION_WIFI else Settings.ACTION_WIFI_SETTINGS)
        QrKind.CONTACT -> "Afegeix a contactes" to Intent(Intent.ACTION_INSERT, ContactsContract.Contacts.CONTENT_URI).apply {
            putExtra(ContactsContract.Intents.Insert.NAME, item.display)
            item.contactPhone?.let { putExtra(ContactsContract.Intents.Insert.PHONE, it) }
            item.contactEmail?.let { putExtra(ContactsContract.Intents.Insert.EMAIL, it) }
        }
        QrKind.EVENT -> "Afegeix al calendari" to Intent(Intent.ACTION_INSERT, CalendarContract.Events.CONTENT_URI).apply {
            putExtra(CalendarContract.Events.TITLE, item.display)
            item.eventLocation?.let { putExtra(CalendarContract.Events.EVENT_LOCATION, it) }
            item.eventStart?.let { value ->
                runCatching {
                    val parsed = java.time.LocalDateTime.parse(value, java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss"))
                    putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, parsed.atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli())
                }
            }
        }
        QrKind.TEXT -> null
    }

    private fun share(raw: String) = safeStart(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"; putExtra(Intent.EXTRA_TEXT, raw)
    }, "Comparteix el codi QR"))

    private fun menu(anchor: View) {
        PopupMenu(this, anchor).apply {
            menu.add("Comprova si hi ha actualitzacions").setOnMenuItemClickListener {
                updateChecker.check(true, BuildConfig.VERSION_NAME) { response ->
                    response.fold(onSuccess = { release -> if (release == null) toast("Ja tens la versió més recent") else showUpdate(release) },
                        onFailure = { toast("No s'ha pogut comprovar. Revisa la connexió i torna-ho a provar") })
                }; true
            }
            menu.add("Quant a l'aplicació").setOnMenuItemClickListener { showAbout(); true }
            show()
        }
    }

    private fun showAbout() {
        android.app.AlertDialog.Builder(this).setTitle("Lector QR · ${BuildConfig.VERSION_NAME}")
            .setMessage("Codi amb llicència MIT; icona de Felip Sarroca amb llicència CC BY-NC-SA 4.0. Els QR es llegeixen al dispositiu i no es guarden ni s'envien. Internet només s'utilitza per comprovar actualitzacions.\n\nMotor QR: ZXing-C++ (Apache 2.0). Càmera: AndroidX CameraX (Apache 2.0).")
            .setPositiveButton("Repositori") { _, _ -> safeStart(Intent(Intent.ACTION_VIEW, Uri.parse("https://github.com/felipsarroca/lector-qr-android"))) }
            .setNegativeButton("Tanca", null).show()
    }

    private fun showUpdate(release: Release) {
        if (result != null) { pendingRelease = release; return }
        val banner = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(Color.rgb(225, 246, 235)); setPadding(dp(16), dp(8), dp(16), dp(8)) }
        banner.addView(label("Hi ha una versió nova disponible (${release.version})", 15f, Color.BLACK))
        val row = LinearLayout(this)
        banner.addView(row)
        row.addView(actionButton("Veure actualització") { safeStart(Intent(Intent.ACTION_VIEW, Uri.parse(release.url))); root.removeView(banner) })
        row.addView(actionButton("Descarta") { updateChecker.dismiss(release.version); root.removeView(banner) })
        root.addView(banner, FrameLayout.LayoutParams(-1, -2, Gravity.TOP))
    }

    private fun safeStart(intent: Intent) {
        try { startActivity(intent) } catch (_: Exception) { toast("No hi ha cap aplicació que pugui fer aquesta acció") }
    }
    private fun toast(message: String) { Toast.makeText(this, message, Toast.LENGTH_LONG).show() }
    private fun label(text: String, sp: Float, color: Int) = TextView(this).apply { this.text = text; textSize = sp; setTextColor(color) }
    private fun actionButton(text: String, click: () -> Unit) = Button(this).apply { this.text = text; minHeight = dp(48); setOnClickListener { click() } }
    private fun iconButton(symbol: String, description: String, click: (View) -> Unit) = Button(this).apply {
        text = symbol; textSize = 25f; contentDescription = description; minWidth = dp(48); minHeight = dp(48); setTextColor(Color.WHITE)
        setBackgroundColor(Color.TRANSPARENT); setOnClickListener { click(this) }
    }
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
    @Deprecated("Android back navigation")
    override fun onBackPressed() { if (result != null) showScanner() else super.onBackPressed() }
}

private class CornerOverlay(context: Context) : View(context) {
    private val outline = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.BLACK; strokeWidth = resources.displayMetrics.density * 8; style = Paint.Style.STROKE }
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE; strokeWidth = resources.displayMetrics.density * 4; style = Paint.Style.STROKE }
    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val size = minOf(width, height) * 0.64f; val left = (width - size) / 2; val top = (height - size) / 2; val end = size * 0.15f
        for (x in listOf(left, left + size)) for (y in listOf(top, top + size)) {
            val dx = if (x == left) end else -end; val dy = if (y == top) end else -end
            canvas.drawLine(x, y, x + dx, y, outline); canvas.drawLine(x, y, x, y + dy, outline)
            canvas.drawLine(x, y, x + dx, y, paint); canvas.drawLine(x, y, x, y + dy, paint)
        }
    }
}
