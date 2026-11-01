package cat.felipsarroca.lectorqr

import android.Manifest
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Typeface
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.BitmapFactory
import android.content.res.ColorStateList
import android.graphics.drawable.GradientDrawable
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
import androidx.core.graphics.drawable.DrawableCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import zxingcpp.BarcodeReader

class MainActivity : ComponentActivity() {
    private val dark = Color.rgb(15, 47, 40)
    private val mint = Color.rgb(102, 224, 180)
    private val page = Color.rgb(246, 249, 247)
    private val muted = Color.rgb(93, 111, 103)
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
        val main = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(dark) }
        root.addView(main, FrameLayout.LayoutParams(-1, -1))
        val top = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; setPadding(dp(24), 0, dp(14), 0) }
        main.addView(top, LinearLayout.LayoutParams(-1, dp(64)))
        top.addView(label("Lector QR", 22f, Color.WHITE).apply { typeface = Typeface.DEFAULT_BOLD }, LinearLayout.LayoutParams(0, -2, 1f))
        top.addView(iconButton("⋮", "Menú") { anchor -> menu(anchor) }, LinearLayout.LayoutParams(dp(48), dp(48)))
        val area = FrameLayout(this)
        main.addView(area, LinearLayout.LayoutParams(-1, 0, 1f))
        val cameraAllowed = ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        cameraPermissionAtLastRender = cameraAllowed
        if (cameraAllowed) {
            val preview = PreviewView(this).apply { scaleType = PreviewView.ScaleType.FILL_CENTER }
            area.addView(preview, FrameLayout.LayoutParams(-1, -1))
            area.addView(ScannerOverlay(this), FrameLayout.LayoutParams(-1, -1))
            startCamera(preview)
        } else {
            val message = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER; setPadding(dp(30), 0, dp(30), 0) }
            area.addView(message, FrameLayout.LayoutParams(-1, -1))
            message.addView(label("Cal permetre l'accés a la càmera per escanejar codis QR. També pots llegir una fotografia.", 18f, Color.WHITE))
            message.addView(styledButton("Permet accedir a la càmera", R.drawable.ic_ui_scan, true) { permission.launch(Manifest.permission.CAMERA) })
            if (!shouldShowRequestPermissionRationale(Manifest.permission.CAMERA))
                message.addView(styledButton("Obre els ajustaments d'Android", null, false) {
                    safeStart(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName")))
                })
        }
        val footer = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER; setPadding(dp(16), dp(12), dp(16), dp(14)) }
        main.addView(footer, LinearLayout.LayoutParams(-1, dp(174)))
        val instruction = label("Apunta la càmera a un codi QR", 15f, Color.WHITE).apply {
            gravity = Gravity.CENTER; setPadding(dp(16), dp(10), dp(16), dp(10)); background = rounded(Color.rgb(31, 76, 62), 18)
        }
        footer.addView(instruction)
        val controls = LinearLayout(this).apply { gravity = Gravity.CENTER; setPadding(0, dp(12), 0, 0) }
        footer.addView(controls)
        controls.addView(scannerControl(R.drawable.ic_ui_flash, "Llanterna", "Activa o desactiva la llanterna") { button ->
            val c = camera
            if (c?.cameraInfo?.hasFlashUnit() == true) {
                torch = !torch; c.cameraControl.enableTorch(torch)
                button.background = rounded(if (torch) mint else Color.rgb(34, 85, 68), 18)
                button.imageTintList = ColorStateList.valueOf(if (torch) dark else Color.WHITE)
            }
            else toast("Aquest dispositiu no té llanterna disponible")
        }, LinearLayout.LayoutParams(dp(100), -2))
        controls.addView(scannerControl(R.drawable.ic_ui_photo, "Fotografia", "Llegeix un QR d'una fotografia") {
            pickerOpen = true; scanning.set(false)
            picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
        }, LinearLayout.LayoutParams(dp(100), -2))
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
        val layout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(page) }
        root.addView(layout, FrameLayout.LayoutParams(-1, -1))
        val header = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; setPadding(dp(14), 0, dp(22), 0) }
        layout.addView(header, LinearLayout.LayoutParams(-1, dp(64)))
        header.addView(ImageButton(this).apply {
            setImageResource(R.drawable.ic_ui_back)
            imageTintList = ColorStateList.valueOf(dark)
            contentDescription = "Torna a escanejar"
            background = rounded(Color.TRANSPARENT, 16)
            setOnClickListener { showScanner() }
        }, LinearLayout.LayoutParams(dp(48), dp(48)))
        header.addView(label("Resultat", 18f, dark).apply { typeface = Typeface.DEFAULT_BOLD; setPadding(dp(8), 0, 0, 0) })
        val scroll = ScrollView(this).apply { isFillViewport = true; clipToPadding = false }
        layout.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        val body = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(22), dp(14), dp(22), dp(24)) }
        scroll.addView(body)
        val identity = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        body.addView(identity, LinearLayout.LayoutParams(-1, dp(64)))
        val symbol = when (item.kind) {
            QrKind.WEB -> "↗"; QrKind.TEXT -> "Aa"; QrKind.WIFI -> "⌁"; QrKind.CONTACT -> "◉"
            QrKind.PHONE -> "☎"; QrKind.EMAIL, QrKind.SMS -> "✉"; QrKind.GEO -> "⌖"; QrKind.EVENT -> "▣"
        }
        identity.addView(label(symbol, 25f, dark).apply {
            gravity = Gravity.CENTER; typeface = Typeface.DEFAULT_BOLD
            background = rounded(Color.rgb(219, 244, 231), 17)
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }, LinearLayout.LayoutParams(dp(56), dp(56)))
        identity.addView(label(item.title, 28f, dark).apply { typeface = Typeface.DEFAULT_BOLD; setPadding(dp(16), 0, 0, 0) })
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(dp(22), dp(22), dp(22), dp(22))
            background = rounded(Color.WHITE, 24); elevation = dp(2).toFloat()
        }
        body.addView(card, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(22) })
        val isWeb = item.kind == QrKind.WEB
        card.addView(label(if (isWeb) "DOMINI" else "CONTINGUT", 12f, muted).apply { typeface = Typeface.DEFAULT_BOLD; letterSpacing = 0.09f })
        card.addView(label(item.display, if (isWeb) 25f else 20f, dark).apply {
            typeface = if (isWeb) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
            setPadding(0, dp(9), 0, 0); setTextIsSelectable(true)
        })
        if (isWeb) {
            card.addView(View(this).apply { setBackgroundColor(Color.rgb(229, 235, 231)) }, LinearLayout.LayoutParams(-1, dp(1)).apply { topMargin = dp(22); bottomMargin = dp(18) })
            card.addView(label("ADREÇA COMPLETA", 12f, muted).apply { typeface = Typeface.DEFAULT_BOLD; letterSpacing = 0.09f })
            card.addView(label(item.detail ?: item.raw, 16f, Color.rgb(42, 70, 59)).apply {
                setPadding(0, dp(9), 0, 0); setTextIsSelectable(true); breakStrategy = android.text.Layout.BREAK_STRATEGY_HIGH_QUALITY
            })
        } else {
            item.detail?.takeIf { it.isNotBlank() && item.kind != QrKind.WIFI }?.let {
                card.addView(label(it, 16f, muted).apply { setPadding(0, dp(16), 0, 0); setTextIsSelectable(true) })
            }
        }
        if (item.kind == QrKind.WIFI && item.wifiPassword != null) {
            val password = label("Contrasenya: ••••••••", 16f, muted).apply { setPadding(0, dp(18), 0, 0) }
            card.addView(password)
            card.addView(styledButton("Mostra la contrasenya", null, false) { password.text = "Contrasenya: ${item.wifiPassword}" }, LinearLayout.LayoutParams(-1, dp(50)).apply { topMargin = dp(14) })
        }
        val actions = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(dp(22), dp(16), dp(22), dp(16))
            setBackgroundColor(Color.WHITE); elevation = dp(8).toFloat()
        }
        layout.addView(actions)
        val primary = primaryAction(item)
        if (primary != null) actions.addView(styledButton(primary.first, R.drawable.ic_ui_open, true) { safeStart(primary.second) }, LinearLayout.LayoutParams(-1, dp(54)))
        else actions.addView(styledButton("Copia el contingut", R.drawable.ic_ui_copy, true) { copy(item.raw) }, LinearLayout.LayoutParams(-1, dp(54)))
        val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        actions.addView(row, LinearLayout.LayoutParams(-1, dp(52)).apply { topMargin = dp(10) })
        if (primary != null) row.addView(styledButton("Copia", R.drawable.ic_ui_copy, false) { copy(item.raw) }, LinearLayout.LayoutParams(0, -1, 1f))
        val canShare = item.kind in setOf(QrKind.WEB, QrKind.TEXT, QrKind.CONTACT, QrKind.EVENT)
        if (canShare) row.addView(styledButton("Comparteix", R.drawable.ic_ui_share, false) { share(item.raw) }, LinearLayout.LayoutParams(0, -1, 1f).apply { if (primary != null) leftMargin = dp(10) })
        if (row.childCount == 0) row.visibility = View.GONE
        actions.addView(styledButton("Escaneja un altre QR", R.drawable.ic_ui_scan, false) { showScanner() }, LinearLayout.LayoutParams(-1, dp(52)).apply { topMargin = dp(10) })
    }

    private fun copy(raw: String) {
        (getSystemService(CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("Codi QR", raw))
        toast("Contingut copiat")
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
    private fun rounded(color: Int, radius: Int, border: Int? = null) = GradientDrawable().apply {
        setColor(color); cornerRadius = dp(radius).toFloat()
        border?.let { setStroke(dp(1), it) }
    }
    private fun styledButton(text: String, icon: Int?, primary: Boolean, click: () -> Unit) = Button(this).apply {
        this.text = text; isAllCaps = false; textSize = 15f; typeface = Typeface.DEFAULT_BOLD
        minHeight = dp(48); gravity = Gravity.CENTER; setPadding(dp(14), 0, dp(14), 0)
        setTextColor(if (primary) Color.WHITE else dark)
        backgroundTintList = null
        background = rounded(if (primary) Color.rgb(21, 113, 81) else Color.WHITE, 16,
            if (primary) null else Color.rgb(207, 222, 213))
        icon?.let { res ->
            ContextCompat.getDrawable(this@MainActivity, res)?.mutate()?.let { drawable ->
                DrawableCompat.setTint(drawable, if (primary) Color.WHITE else dark)
                setCompoundDrawablesWithIntrinsicBounds(drawable, null, null, null)
                compoundDrawablePadding = dp(9)
            }
        }
        setOnClickListener { click() }
    }
    private fun scannerControl(icon: Int, text: String, description: String, click: (ImageButton) -> Unit) = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER
        val button = ImageButton(this@MainActivity).apply {
            setImageResource(icon); imageTintList = ColorStateList.valueOf(Color.WHITE)
            contentDescription = description; background = rounded(Color.rgb(34, 85, 68), 18)
            setOnClickListener { click(this) }
        }
        addView(button, LinearLayout.LayoutParams(dp(56), dp(56)))
        addView(label(text, 12f, Color.WHITE).apply { gravity = Gravity.CENTER; setPadding(0, dp(5), 0, 0) })
    }
    private fun iconButton(symbol: String, description: String, click: (View) -> Unit) = Button(this).apply {
        text = symbol; textSize = 25f; contentDescription = description; minWidth = dp(48); minHeight = dp(48); setTextColor(Color.WHITE)
        backgroundTintList = null; background = rounded(Color.TRANSPARENT, 16); setOnClickListener { click(this) }
    }
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
    @Deprecated("Android back navigation")
    override fun onBackPressed() { if (result != null) showScanner() else super.onBackPressed() }
}

private class ScannerOverlay(context: Context) : View(context) {
    private val density = resources.displayMetrics.density
    private val shade = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(135, 9, 32, 26) }
    private val frame = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(170, 255, 255, 255); strokeWidth = density * 1.5f; style = Paint.Style.STROKE }
    private val outline = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(180, 8, 37, 29); strokeWidth = density * 7; style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND }
    private val corners = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(102, 224, 180); strokeWidth = density * 4; style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND }
    private val lineOutline = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(180, 8, 37, 29); strokeWidth = density * 6; strokeCap = Paint.Cap.ROUND }
    private val line = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(255, 117, 106); strokeWidth = density * 2.5f; strokeCap = Paint.Cap.ROUND }
    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val side = minOf(width * 0.76f, height * 0.64f, density * 340)
        val box = RectF((width - side) / 2, (height - side) / 2, (width + side) / 2, (height + side) / 2)
        canvas.drawRect(0f, 0f, width.toFloat(), box.top, shade)
        canvas.drawRect(0f, box.bottom, width.toFloat(), height.toFloat(), shade)
        canvas.drawRect(0f, box.top, box.left, box.bottom, shade)
        canvas.drawRect(box.right, box.top, width.toFloat(), box.bottom, shade)
        canvas.drawRoundRect(box, density * 22, density * 22, frame)
        val end = side * 0.14f
        for (x in listOf(box.left, box.right)) for (y in listOf(box.top, box.bottom)) {
            val dx = if (x == box.left) end else -end; val dy = if (y == box.top) end else -end
            canvas.drawLine(x, y, x + dx, y, outline); canvas.drawLine(x, y, x, y + dy, outline)
            canvas.drawLine(x, y, x + dx, y, corners); canvas.drawLine(x, y, x, y + dy, corners)
        }
        val y = box.centerY()
        canvas.drawLine(box.left + side * 0.16f, y, box.right - side * 0.16f, y, lineOutline)
        canvas.drawLine(box.left + side * 0.16f, y, box.right - side * 0.16f, y, line)
    }
}
