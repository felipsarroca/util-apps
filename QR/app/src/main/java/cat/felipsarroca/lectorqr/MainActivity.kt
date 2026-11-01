package cat.felipsarroca.lectorqr

import android.Manifest
import android.animation.ValueAnimator
import android.content.ClipData
import android.content.ClipDescription
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.net.wifi.WifiNetworkSuggestion
import android.os.Build
import android.os.Bundle
import android.os.PersistableBundle
import android.provider.CalendarContract
import android.provider.ContactsContract
import android.provider.Settings
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.View
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.ImageView
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
import androidx.core.graphics.Insets
import androidx.core.graphics.drawable.DrawableCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import java.util.Locale
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import zxingcpp.BarcodeReader

class MainActivity : ComponentActivity() {
    private val dark = Color.rgb(15, 47, 40)
    private val mint = Color.rgb(102, 224, 180)
    private val green = Color.rgb(21, 113, 81)
    private val page = Color.rgb(246, 249, 247)
    private val muted = Color.rgb(79, 99, 90)
    private val tonal = Color.rgb(232, 243, 237)
    private val badge = Color.rgb(219, 244, 231)
    private val line = Color.rgb(229, 235, 231)
    private val border = Color.rgb(207, 222, 213)
    private val catalan: Locale = Locale.forLanguageTag("ca")
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
    private var bars: Insets = Insets.NONE
    private var scannerTop: View? = null
    private var scannerBottom: View? = null
    private var overlay: ScannerOverlay? = null
    private var banner: View? = null
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
                if (value != null) confirmDetection(value) else {
                    scanning.set(true)
                    toast("No s'ha trobat cap codi QR a la imatge")
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        updateChecker = UpdateChecker(this)
        root = FrameLayout(this)
        ViewCompat.setOnApplyWindowInsetsListener(root) { _, insets ->
            bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            applyInsets()
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

    /** The scanner draws under the system bars; the result screen keeps clear of them. */
    private fun applyInsets() {
        if (result == null) {
            root.setPadding(0, 0, 0, 0)
            scannerTop?.setPadding(bars.left + dp(24), bars.top + dp(6), bars.right + dp(10), dp(36))
            scannerBottom?.setPadding(bars.left + dp(16), dp(56), bars.right + dp(16), bars.bottom + dp(28))
        } else root.setPadding(bars.left, bars.top, bars.right, bars.bottom)
        banner?.let { view ->
            (view.layoutParams as? FrameLayout.LayoutParams)?.let { it.topMargin = (if (result == null) bars.top else 0) + dp(70); view.layoutParams = it }
        }
    }

    private fun setLightBars(light: Boolean) {
        WindowInsetsControllerCompat(window, root).apply {
            isAppearanceLightStatusBars = light; isAppearanceLightNavigationBars = light
        }
    }

    private fun showScanner() {
        result = null; camera = null; torch = false; banner = null; root.removeAllViews()
        root.setBackgroundColor(dark)
        setLightBars(false)
        val cameraAllowed = ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        cameraPermissionAtLastRender = cameraAllowed
        overlay = null
        if (cameraAllowed) {
            val preview = PreviewView(this).apply { scaleType = PreviewView.ScaleType.FILL_CENTER }
            root.addView(preview, FrameLayout.LayoutParams(-1, -1))
            overlay = ScannerOverlay(this).also { root.addView(it, FrameLayout.LayoutParams(-1, -1)) }
            startCamera(preview)
        } else {
            val message = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER; setPadding(dp(30), dp(80), dp(30), dp(200)) }
            root.addView(message, FrameLayout.LayoutParams(-1, -1))
            message.addView(label("Cal permetre l'accés a la càmera per escanejar codis QR. També pots llegir una fotografia.", 18f, Color.WHITE).apply { gravity = Gravity.CENTER })
            message.addView(styledButton("Permet accedir a la càmera", R.drawable.ic_ui_scan, Style.PRIMARY) { permission.launch(Manifest.permission.CAMERA) },
                LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(22) })
            if (!shouldShowRequestPermissionRationale(Manifest.permission.CAMERA))
                message.addView(styledButton("Obre els ajustaments d'Android", null, Style.TONAL) {
                    safeStart(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName")))
                }, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(10) })
        }

        val top = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
            background = GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, intArrayOf(Color.argb(217, 15, 47, 40), Color.argb(0, 15, 47, 40)))
        }
        top.addView(label("Lector QR", 20f, Color.WHITE).apply { typeface = Typeface.DEFAULT_BOLD }, LinearLayout.LayoutParams(0, -2, 1f))
        top.addView(ImageButton(this).apply {
            setImageResource(R.drawable.ic_ui_more); imageTintList = ColorStateList.valueOf(Color.WHITE)
            contentDescription = "Menú"; background = rounded(Color.TRANSPARENT, 24)
            setOnClickListener { menu(it) }
        }, LinearLayout.LayoutParams(dp(48), dp(48)))
        root.addView(top, FrameLayout.LayoutParams(-1, -2, Gravity.TOP))
        scannerTop = top

        val bottom = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER_HORIZONTAL
            background = GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, intArrayOf(Color.argb(0, 15, 47, 40), Color.argb(242, 15, 47, 40)))
        }
        if (cameraAllowed) bottom.addView(label("Apunta la càmera a un codi QR", 16f, Color.WHITE).apply {
            gravity = Gravity.CENTER; setShadowLayer(dp(4).toFloat(), 0f, dp(1).toFloat(), Color.argb(150, 0, 0, 0))
        }, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(26) })
        val controls = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER }
        bottom.addView(controls)
        if (cameraAllowed) controls.addView(scannerControl(R.drawable.ic_ui_flash, "Llanterna", "Activa o desactiva la llanterna") { button ->
            val c = camera
            if (c?.cameraInfo?.hasFlashUnit() == true) {
                torch = !torch; c.cameraControl.enableTorch(torch)
                button.background = circle(if (torch) mint else Color.argb(31, 255, 255, 255), torch)
                button.imageTintList = ColorStateList.valueOf(if (torch) dark else Color.WHITE)
            } else toast("Aquest dispositiu no té llanterna disponible")
        }, LinearLayout.LayoutParams(dp(112), -2))
        controls.addView(scannerControl(R.drawable.ic_ui_photo, "Fotografia", "Llegeix un QR d'una fotografia") {
            pickerOpen = true; scanning.set(false)
            picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
        }, LinearLayout.LayoutParams(dp(112), -2))
        root.addView(bottom, FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM))
        scannerBottom = bottom

        applyInsets(); ViewCompat.requestApplyInsets(root)
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
                            if (found != null && scanning.compareAndSet(true, false)) runOnUiThread { confirmDetection(found) }
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

    /** A light vibration and a brief flash of the corners, then the result. */
    private fun confirmDetection(value: String) {
        if (result != null) return
        overlay?.confirm()
        root.performHapticFeedback(if (Build.VERSION.SDK_INT >= 30) HapticFeedbackConstants.CONFIRM else HapticFeedbackConstants.VIRTUAL_KEY)
        root.postDelayed({ if (!isFinishing && result == null) displayResult(value) }, if (overlay != null) 240L else 0L)
    }

    private fun showCameraError() {
        scanning.set(false)
        toast("No s'ha pogut obrir la càmera. Pots llegir un QR d'una fotografia.")
    }

    private fun displayResult(raw: String) {
        if (result != null) return
        val item = QrContentParser.parse(raw); result = item; scanning.set(false); provider?.unbindAll(); camera = null
        overlay = null; scannerTop = null; scannerBottom = null; banner = null
        root.removeAllViews()
        root.setBackgroundColor(page)
        setLightBars(true)
        val layout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(page) }
        root.addView(layout, FrameLayout.LayoutParams(-1, -1))
        val header = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; setPadding(dp(12), 0, dp(22), 0) }
        layout.addView(header, LinearLayout.LayoutParams(-1, dp(64)))
        header.addView(ImageButton(this).apply {
            setImageResource(R.drawable.ic_ui_back)
            imageTintList = ColorStateList.valueOf(dark)
            contentDescription = "Torna a escanejar"
            background = rounded(Color.TRANSPARENT, 24)
            setOnClickListener { showScanner() }
        }, LinearLayout.LayoutParams(dp(48), dp(48)))
        header.addView(label("Resultat", 18f, dark).apply { typeface = Typeface.DEFAULT_BOLD; setPadding(dp(6), 0, 0, 0) })

        val scroll = ScrollView(this).apply { isFillViewport = true; clipToPadding = false }
        layout.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        val body = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(22), dp(12), dp(22), dp(24)) }
        scroll.addView(body)

        val identity = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        body.addView(identity)
        identity.addView(FrameLayout(this).apply {
            background = rounded(badge, 16); importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
            addView(ImageView(this@MainActivity).apply { setImageResource(kindIcon(item.kind)); imageTintList = ColorStateList.valueOf(green) },
                FrameLayout.LayoutParams(dp(24), dp(24), Gravity.CENTER))
        }, LinearLayout.LayoutParams(dp(48), dp(48)))
        identity.addView(label(item.title.uppercase(catalan), 13f, muted).apply {
            typeface = Typeface.DEFAULT_BOLD; letterSpacing = 0.09f; setPadding(dp(14), 0, 0, 0)
        })

        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(dp(22), dp(24), dp(22), dp(24))
            background = rounded(Color.WHITE, 24); elevation = dp(2).toFloat()
        }
        body.addView(card, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(20) })
        when (item.kind) {
            QrKind.WEB -> {
                card.addView(headline(item.display, 30f))
                card.addView(label("Domini real de l'enllaç", 14f, muted).apply { setPadding(0, dp(6), 0, 0) })
                card.addView(divider(), dividerParams())
                card.addView(caption("ADREÇA COMPLETA"))
                card.addView(label(item.detail ?: item.raw, 16f, Color.rgb(42, 70, 59)).apply {
                    setPadding(0, dp(8), 0, 0); setTextIsSelectable(true); setLineSpacing(0f, 1.15f)
                    breakStrategy = android.text.Layout.BREAK_STRATEGY_HIGH_QUALITY
                })
            }
            QrKind.WIFI -> {
                card.addView(headline(item.display, 30f))
                card.addView(label(wifiSecurityLabel(item), 14f, muted).apply { setPadding(0, dp(6), 0, 0) })
                item.wifiPassword?.let { secret ->
                    card.addView(divider(), dividerParams())
                    card.addView(caption("CONTRASENYA"))
                    val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
                    card.addView(row, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(4) })
                    val hidden = "•".repeat(10)
                    val value = label(hidden, 20f, Color.rgb(42, 70, 59)).apply { letterSpacing = 0.12f; setTextIsSelectable(true) }
                    row.addView(value, LinearLayout.LayoutParams(0, -2, 1f))
                    row.addView(styledButton("Mostra", null, Style.TONAL, compact = true) { }.apply {
                        setOnClickListener {
                            val showing = value.text.toString() != hidden
                            value.text = if (showing) hidden else secret
                            value.letterSpacing = if (showing) 0.12f else 0f
                            text = if (showing) "Mostra" else "Amaga"
                        }
                    }, LinearLayout.LayoutParams(-2, dp(44)))
                }
            }
            QrKind.EVENT -> {
                card.addView(headline(item.display, 28f))
                val whenever = EventDates.describe(item.eventStart, item.eventEnd)
                if (whenever != null) card.addView(infoRow(R.drawable.ic_ui_clock, whenever.dateLine, whenever.timeLine))
                else item.eventStart?.let { card.addView(infoRow(R.drawable.ic_ui_clock, it, null)) }
                item.eventLocation?.takeIf { it.isNotBlank() }?.let { card.addView(infoRow(R.drawable.ic_ui_pin, it, null)) }
            }
            QrKind.TEXT -> card.addView(label(item.display, 19f, dark).apply { setTextIsSelectable(true); setLineSpacing(0f, 1.2f) })
            else -> {
                card.addView(headline(item.display, 26f))
                item.detail?.takeIf { it.isNotBlank() && it != item.display }?.let {
                    card.addView(label(it, 16f, muted).apply { setPadding(0, dp(12), 0, 0); setTextIsSelectable(true) })
                }
            }
        }

        val actions = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(dp(22), dp(16), dp(22), dp(16))
            setBackgroundColor(Color.WHITE); elevation = dp(8).toFloat()
        }
        layout.addView(actions)
        val primary = primaryAction(item)
        if (primary != null) actions.addView(styledButton(primary.first, primaryIcon(item.kind), Style.PRIMARY) { primary.second() }, LinearLayout.LayoutParams(-1, -2))
        else actions.addView(styledButton("Copia el contingut", R.drawable.ic_ui_copy, Style.PRIMARY) { copy(item.raw) }, LinearLayout.LayoutParams(-1, -2))
        val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        actions.addView(row, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(10) })
        if (item.kind == QrKind.WIFI) {
            item.wifiPassword?.let { secret -> row.addView(styledButton("Copia la contrasenya", R.drawable.ic_ui_copy, Style.OUTLINE) { copy(secret, sensitive = true) }, LinearLayout.LayoutParams(0, -2, 1f)) }
        } else {
            if (primary != null) row.addView(styledButton("Copia", R.drawable.ic_ui_copy, Style.OUTLINE) { copy(item.raw) }, LinearLayout.LayoutParams(0, -2, 1f))
            val canShare = item.kind in setOf(QrKind.WEB, QrKind.TEXT, QrKind.CONTACT, QrKind.EVENT)
            if (canShare) row.addView(styledButton("Comparteix", R.drawable.ic_ui_share, Style.OUTLINE) { share(item.raw) },
                LinearLayout.LayoutParams(0, -2, 1f).apply { if (row.childCount > 0) leftMargin = dp(10) })
        }
        if (row.childCount == 0) row.visibility = View.GONE
        actions.addView(styledButton("Escaneja un altre QR", R.drawable.ic_ui_scan, Style.TONAL) { showScanner() }, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(10) })
        applyInsets(); ViewCompat.requestApplyInsets(root)
    }

    private fun kindIcon(kind: QrKind) = when (kind) {
        QrKind.WEB -> R.drawable.ic_kind_link; QrKind.TEXT -> R.drawable.ic_kind_text; QrKind.WIFI -> R.drawable.ic_kind_wifi
        QrKind.CONTACT -> R.drawable.ic_kind_contact; QrKind.PHONE -> R.drawable.ic_kind_phone; QrKind.EMAIL -> R.drawable.ic_kind_mail
        QrKind.SMS -> R.drawable.ic_kind_sms; QrKind.GEO -> R.drawable.ic_ui_pin; QrKind.EVENT -> R.drawable.ic_kind_event
    }
    private fun primaryIcon(kind: QrKind) = when (kind) {
        QrKind.WIFI -> R.drawable.ic_kind_wifi; QrKind.EVENT -> R.drawable.ic_kind_event; QrKind.CONTACT -> R.drawable.ic_kind_contact
        QrKind.PHONE -> R.drawable.ic_kind_phone; QrKind.EMAIL -> R.drawable.ic_kind_mail; QrKind.SMS -> R.drawable.ic_kind_sms
        QrKind.GEO -> R.drawable.ic_ui_pin; else -> R.drawable.ic_ui_open
    }

    private fun wifiSecurityLabel(item: QrContent): String {
        val base = when (item.wifiSecurity) { "WPA" -> "Seguretat WPA"; "SAE" -> "Seguretat WPA3"; "WEP" -> "Seguretat WEP (antiga)"; else -> "Xarxa oberta, sense contrasenya" }
        return if (item.wifiHidden) "$base · xarxa oculta" else base
    }

    private fun copy(raw: String, sensitive: Boolean = false) {
        val clip = ClipData.newPlainText(if (sensitive) "Contrasenya Wi-Fi" else "Codi QR", raw)
        if (sensitive) clip.description.extras = PersistableBundle().apply {
            putBoolean(if (Build.VERSION.SDK_INT >= 33) ClipDescription.EXTRA_IS_SENSITIVE else "android.content.extra.IS_SENSITIVE", true)
        }
        (getSystemService(CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(clip)
        // Android 13 and later already confirm every copy on screen.
        if (Build.VERSION.SDK_INT < 33) toast(if (sensitive) "Contrasenya copiada" else "Contingut copiat")
    }

    private fun primaryAction(item: QrContent): Pair<String, () -> Unit>? {
        fun open(intent: Intent): () -> Unit = { safeStart(intent) }
        return when (item.kind) {
            QrKind.WEB -> "Obre l'enllaç" to open(Intent(Intent.ACTION_VIEW, Uri.parse(item.actionData)))
            QrKind.PHONE -> "Obre el marcador" to open(Intent(Intent.ACTION_DIAL, Uri.parse(item.actionData)))
            QrKind.EMAIL -> "Prepara un correu" to open(Intent(Intent.ACTION_SENDTO, Uri.parse(item.actionData)))
            QrKind.SMS -> "Prepara un SMS" to open(Intent(Intent.ACTION_SENDTO, Uri.parse(item.actionData)))
            QrKind.GEO -> "Obre al mapa" to open(Intent(Intent.ACTION_VIEW, Uri.parse(item.actionData)))
            QrKind.WIFI -> (if (canSuggestWifi(item)) "Connecta't a la xarxa" else "Obre els ajustaments Wi-Fi") to { connectWifi(item) }
            QrKind.CONTACT -> "Afegeix a contactes" to open(Intent(Intent.ACTION_INSERT, ContactsContract.Contacts.CONTENT_URI).apply {
                putExtra(ContactsContract.Intents.Insert.NAME, item.display)
                item.contactPhone?.let { putExtra(ContactsContract.Intents.Insert.PHONE, it) }
                item.contactEmail?.let { putExtra(ContactsContract.Intents.Insert.EMAIL, it) }
            })
            QrKind.EVENT -> "Afegeix al calendari" to open(Intent(Intent.ACTION_INSERT, CalendarContract.Events.CONTENT_URI).apply {
                putExtra(CalendarContract.Events.TITLE, item.display)
                item.eventLocation?.let { putExtra(CalendarContract.Events.EVENT_LOCATION, it) }
                EventDates.describe(item.eventStart, item.eventEnd)?.let { whenever ->
                    putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, whenever.beginMillis)
                    whenever.endMillis?.let { putExtra(CalendarContract.EXTRA_EVENT_END_TIME, it) }
                    if (whenever.allDay) putExtra(CalendarContract.EXTRA_EVENT_ALL_DAY, true)
                }
            })
            QrKind.TEXT -> null
        }
    }

    /** Android 11+ can offer the network directly; the user still confirms it in a system dialog. */
    private fun canSuggestWifi(item: QrContent) = Build.VERSION.SDK_INT >= 30 && item.wifiSecurity != "WEP"

    private fun connectWifi(item: QrContent) {
        val ssid = item.wifiSsid ?: return
        if (Build.VERSION.SDK_INT >= 30 && item.wifiSecurity != "WEP") {
            val suggestion = runCatching {
                WifiNetworkSuggestion.Builder().setSsid(ssid).apply {
                    val secret = item.wifiPassword
                    when (item.wifiSecurity) {
                        "WPA" -> if (secret != null) setWpa2Passphrase(secret)
                        "SAE" -> if (secret != null) setWpa3Passphrase(secret)
                    }
                    if (item.wifiHidden) setIsHiddenSsid(true)
                }.build()
            }.getOrNull()
            if (suggestion != null) {
                val intent = Intent(Settings.ACTION_WIFI_ADD_NETWORKS)
                    .putParcelableArrayListExtra(Settings.EXTRA_WIFI_NETWORK_LIST, arrayListOf(suggestion))
                if (runCatching { startActivity(intent) }.isSuccess) return
            }
        }
        item.wifiPassword?.let { copy(it, sensitive = true); toast("Contrasenya copiada. Tria la xarxa «$ssid» i enganxa-la.") }
        safeStart(Intent(if (Build.VERSION.SDK_INT >= 29) Settings.Panel.ACTION_WIFI else Settings.ACTION_WIFI_SETTINGS))
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
            .setPositiveButton("Repositori") { _, _ -> safeStart(Intent(Intent.ACTION_VIEW, Uri.parse("https://github.com/felipsarroca/util-apps/tree/main/QR"))) }
            .setNegativeButton("Tanca", null).show()
    }

    private fun showUpdate(release: Release) {
        if (result != null) { pendingRelease = release; return }
        banner?.let { root.removeView(it) }
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(dp(18), dp(14), dp(10), dp(6))
            background = rounded(badge, 20); elevation = dp(6).toFloat()
        }
        card.addView(label("Hi ha una versió nova disponible (${release.version})", 15f, dark).apply { typeface = Typeface.DEFAULT_BOLD })
        val row = LinearLayout(this).apply { gravity = Gravity.END }
        card.addView(row, LinearLayout.LayoutParams(-1, -2))
        row.addView(textButton("Descarta") { updateChecker.dismiss(release.version); root.removeView(card); banner = null })
        row.addView(textButton("Veure-la") { safeStart(Intent(Intent.ACTION_VIEW, Uri.parse(release.url))); root.removeView(card); banner = null })
        root.addView(card, FrameLayout.LayoutParams(-1, -2, Gravity.TOP).apply { leftMargin = dp(16); rightMargin = dp(16) })
        banner = card
        applyInsets()
    }

    private fun safeStart(intent: Intent) {
        try { startActivity(intent) } catch (_: Exception) { toast("No hi ha cap aplicació que pugui fer aquesta acció") }
    }
    private fun toast(message: String) { Toast.makeText(this, message, Toast.LENGTH_LONG).show() }
    private fun label(text: String, sp: Float, color: Int) = TextView(this).apply { this.text = text; textSize = sp; setTextColor(color) }
    private fun headline(text: String, sp: Float) = label(text, sp, dark).apply {
        typeface = Typeface.DEFAULT_BOLD; setTextIsSelectable(true); setLineSpacing(0f, 1.08f)
    }
    private fun caption(text: String) = label(text, 12f, muted).apply { typeface = Typeface.DEFAULT_BOLD; letterSpacing = 0.09f }
    private fun divider() = View(this).apply { setBackgroundColor(line) }
    private fun dividerParams() = LinearLayout.LayoutParams(-1, dp(1)).apply { topMargin = dp(18); bottomMargin = dp(14) }
    private fun infoRow(icon: Int, main: String, secondary: String?) = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL; setPadding(0, dp(18), 0, 0)
        addView(ImageView(this@MainActivity).apply { setImageResource(icon); imageTintList = ColorStateList.valueOf(green) },
            LinearLayout.LayoutParams(dp(20), dp(20)).apply { topMargin = dp(2); rightMargin = dp(12) })
        val texts = LinearLayout(this@MainActivity).apply { orientation = LinearLayout.VERTICAL }
        addView(texts, LinearLayout.LayoutParams(0, -2, 1f))
        texts.addView(label(main, 17f, dark).apply { typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL); setTextIsSelectable(true) })
        secondary?.let { texts.addView(label(it, 15f, muted).apply { setPadding(0, dp(2), 0, 0) }) }
    }
    private fun textButton(text: String, click: () -> Unit) = Button(this).apply {
        this.text = text; isAllCaps = false; textSize = 15f; typeface = Typeface.DEFAULT_BOLD; setTextColor(green)
        minHeight = dp(48); backgroundTintList = null; background = rounded(Color.TRANSPARENT, 12); setOnClickListener { click() }
    }
    private fun rounded(color: Int, radius: Int, stroke: Int? = null) = GradientDrawable().apply {
        setColor(color); cornerRadius = dp(radius).toFloat()
        stroke?.let { setStroke(dp(1), it) }
    }
    private fun circle(color: Int, active: Boolean) = GradientDrawable().apply {
        shape = GradientDrawable.OVAL; setColor(color)
        if (!active) setStroke(dp(1), Color.argb(51, 255, 255, 255))
    }

    private enum class Style { PRIMARY, OUTLINE, TONAL }
    private fun styledButton(text: String, icon: Int?, style: Style, compact: Boolean = false, click: () -> Unit) = Button(this).apply {
        this.text = text; isAllCaps = false; textSize = if (style == Style.PRIMARY) 16f else 15f; typeface = Typeface.DEFAULT_BOLD
        minHeight = dp(if (compact) 44 else if (style == Style.PRIMARY) 54 else 50); minimumHeight = minHeight
        gravity = Gravity.CENTER; setPadding(dp(14), dp(6), dp(14), dp(6)); stateListAnimator = null
        val foreground = if (style == Style.PRIMARY) Color.WHITE else dark
        setTextColor(foreground)
        backgroundTintList = null
        background = when (style) {
            Style.PRIMARY -> rounded(green, 16)
            Style.OUTLINE -> rounded(Color.WHITE, 16, border)
            Style.TONAL -> rounded(tonal, if (compact) 12 else 16)
        }
        icon?.let { res ->
            ContextCompat.getDrawable(this@MainActivity, res)?.mutate()?.let { drawable ->
                DrawableCompat.setTint(drawable, foreground)
                drawable.setBounds(0, 0, dp(20), dp(20))
                setCompoundDrawablesRelative(drawable, null, null, null)
                compoundDrawablePadding = dp(9)
            }
        }
        setOnClickListener { click() }
    }
    private fun scannerControl(icon: Int, text: String, description: String, click: (ImageButton) -> Unit) = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER
        val button = ImageButton(this@MainActivity).apply {
            setImageResource(icon); imageTintList = ColorStateList.valueOf(Color.WHITE)
            contentDescription = description; background = circle(Color.argb(31, 255, 255, 255), false)
            setOnClickListener { click(this) }
        }
        addView(button, LinearLayout.LayoutParams(dp(60), dp(60)))
        addView(label(text, 13f, Color.WHITE).apply { gravity = Gravity.CENTER; setPadding(0, dp(8), 0, 0) })
    }
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
    @Deprecated("Android back navigation")
    override fun onBackPressed() { if (result != null) showScanner() else super.onBackPressed() }
}

/** Four rounded corners around the reading area; they flash white when a code is read. */
private class ScannerOverlay(context: Context) : View(context) {
    private val density = resources.displayMetrics.density
    private val mint = Color.rgb(102, 224, 180)
    private val shadow = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(90, 0, 0, 0); style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND
    }
    private val corners = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND }
    private val path = Path()
    private var flash = 0f

    init { importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO }

    fun confirm() {
        ValueAnimator.ofFloat(0f, 1f, 0f).apply {
            duration = 260
            addUpdateListener { flash = it.animatedValue as Float; invalidate() }
            start()
        }
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val side = minOf(width * 0.68f, height * 0.42f, density * 280) * (1f - 0.04f * flash)
        val cx = width / 2f; val cy = height * 0.44f
        val box = RectF(cx - side / 2, cy - side / 2, cx + side / 2, cy + side / 2)
        val r = density * 24; val len = side * 0.19f
        path.reset()
        path.moveTo(box.left, box.top + len); path.lineTo(box.left, box.top + r)
        path.arcTo(RectF(box.left, box.top, box.left + 2 * r, box.top + 2 * r), 180f, 90f); path.lineTo(box.left + len, box.top)
        path.moveTo(box.right - len, box.top); path.lineTo(box.right - r, box.top)
        path.arcTo(RectF(box.right - 2 * r, box.top, box.right, box.top + 2 * r), 270f, 90f); path.lineTo(box.right, box.top + len)
        path.moveTo(box.right, box.bottom - len); path.lineTo(box.right, box.bottom - r)
        path.arcTo(RectF(box.right - 2 * r, box.bottom - 2 * r, box.right, box.bottom), 0f, 90f); path.lineTo(box.right - len, box.bottom)
        path.moveTo(box.left + len, box.bottom); path.lineTo(box.left + r, box.bottom)
        path.arcTo(RectF(box.left, box.bottom - 2 * r, box.left + 2 * r, box.bottom), 90f, 90f); path.lineTo(box.left, box.bottom - len)
        val stroke = density * (5f + 1.5f * flash)
        shadow.strokeWidth = stroke + density * 3
        corners.strokeWidth = stroke
        corners.color = blend(mint, Color.WHITE, flash)
        canvas.drawPath(path, shadow)
        canvas.drawPath(path, corners)
    }

    private fun blend(a: Int, b: Int, t: Float) = Color.rgb(
        (Color.red(a) + (Color.red(b) - Color.red(a)) * t).toInt(),
        (Color.green(a) + (Color.green(b) - Color.green(a)) * t).toInt(),
        (Color.blue(a) + (Color.blue(b) - Color.blue(a)) * t).toInt())
}
