package cat.felipsarroca.aniversaris.widget

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.core.graphics.scale
import androidx.core.net.toUri
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalContext
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.appWidgetBackground
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.updateAll
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.ContentScale
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import cat.felipsarroca.aniversaris.AniversarisApplication
import cat.felipsarroca.aniversaris.MainActivity
import cat.felipsarroca.aniversaris.domain.birthdays.UpcomingBirthday
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.roundToInt

private enum class WidgetLayout { THREE_BY_ONE, FOUR_BY_ONE }

private abstract class BaseBirthdayWidget(private val layout: WidgetLayout) : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val app = context.applicationContext as AniversarisApplication
        val hasPermission = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED
        val birthdays = if (hasPermission) app.container.repository.getUpcoming(LocalDate.now()).take(4) else emptyList()
        val prefs = app.container.preferences.current()
        val systemDark = context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES
        val dark = when (prefs.widgetTheme) { "DARK" -> true; "LIGHT" -> false; else -> systemDark }
        val photos = if (prefs.showAvatars) birthdays.mapNotNull { item ->
            item.photoThumbnailUri?.let { uri -> loadThumbnail(context, uri)?.let { item.id to it } }
        }.toMap() else emptyMap()
        provideContent { WidgetContent(hasPermission, birthdays, photos, dark, prefs.widgetAlpha, prefs.showAvatars, layout) }
    }

    private fun loadThumbnail(context: Context, value: String): Bitmap? = runCatching {
        context.contentResolver.openInputStream(value.toUri())?.use(BitmapFactory::decodeStream)
            ?.scale(48, 48)
    }.getOrNull()
}

private class BirthdayWidget3x1 : BaseBirthdayWidget(WidgetLayout.THREE_BY_ONE)
private class BirthdayWidget4x1 : BaseBirthdayWidget(WidgetLayout.FOUR_BY_ONE)

class BirthdayWidget3x1Receiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = BirthdayWidget3x1()
}

class BirthdayWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = BirthdayWidget4x1()
}

object BirthdayWidgets {
    suspend fun updateAll(context: Context) {
        BirthdayWidget3x1().updateAll(context)
        BirthdayWidget4x1().updateAll(context)
    }
}

@Composable
private fun WidgetContent(
    hasPermission: Boolean,
    birthdays: List<UpcomingBirthday>,
    photos: Map<String, Bitmap>,
    dark: Boolean,
    alpha: Float,
    showAvatars: Boolean,
    layout: WidgetLayout,
) {
    val context = LocalContext.current
    val background = if (dark) android.graphics.Color.argb((alpha * 255).roundToInt(), 20, 17, 16)
    else android.graphics.Color.argb((alpha * 255).roundToInt(), 255, 250, 248)
    val primaryText = if (dark) Color.White else Color(0xFF2A1915)
    val secondaryText = if (dark) Color(0xFFDDD5D1) else Color(0xFF6F5A54)
    Column(
        modifier = GlanceModifier.fillMaxSize().appWidgetBackground()
            .background(ColorProvider(Color(background))).cornerRadius(18.dp)
            .padding(horizontal = if (layout == WidgetLayout.FOUR_BY_ONE) 7.dp else 5.dp, vertical = 1.dp)
            .clickable(actionStartActivity(Intent(context, MainActivity::class.java))),
    ) {
        when {
            !hasPermission -> WidgetMessage("Dona accés als contactes", primaryText)
            birthdays.isEmpty() -> WidgetMessage("Obre Aniversaris per preparar el widget", primaryText)
            else -> birthdays.take(4).forEach { item ->
                BirthdayRow(item, photos[item.id], showAvatars, layout, primaryText, secondaryText)
            }
        }
    }
}

@Composable
private fun BirthdayRow(
    item: UpcomingBirthday,
    photo: Bitmap?,
    showAvatar: Boolean,
    layout: WidgetLayout,
    primaryText: Color,
    secondaryText: Color,
) {
    val highlight = item.daysRemaining == 0L
    val compact = layout == WidgetLayout.THREE_BY_ONE
    Row(modifier = GlanceModifier.fillMaxWidth().height(15.dp), verticalAlignment = Alignment.CenterVertically) {
        if (showAvatar) {
            if (photo != null) {
                Image(ImageProvider(photo), item.displayName, GlanceModifier.size(15.dp).cornerRadius(8.dp), contentScale = ContentScale.Crop)
            } else {
                Box(GlanceModifier.size(15.dp).cornerRadius(8.dp).background(ColorProvider(Color(0xFFE86850))), contentAlignment = Alignment.Center) {
                    Text(item.displayName.take(1).uppercase(), style = TextStyle(color = ColorProvider(Color.White), fontWeight = FontWeight.Bold, fontSize = 10.sp))
                }
            }
            Spacer(GlanceModifier.width(if (compact) 3.dp else 5.dp))
        }
        Text(
            item.displayName,
            modifier = GlanceModifier.defaultWeight(),
            maxLines = 1,
            style = TextStyle(color = ColorProvider(primaryText), fontWeight = if (highlight) FontWeight.Bold else FontWeight.Normal, fontSize = if (compact) 12.sp else 13.sp),
        )
        Text(
            proximity(item),
            modifier = GlanceModifier.width(if (compact) 43.dp else 48.dp),
            maxLines = 1,
            style = TextStyle(color = ColorProvider(if (highlight) Color(0xFFE86850) else secondaryText), fontSize = if (compact) 11.sp else 12.sp, textAlign = TextAlign.End),
        )
        Text(
            item.ageTurning?.let { "$it a." } ?: "—",
            modifier = GlanceModifier.width(if (compact) 34.dp else 38.dp),
            maxLines = 1,
            style = TextStyle(color = ColorProvider(secondaryText), fontSize = if (compact) 11.sp else 12.sp, textAlign = TextAlign.End),
        )
    }
}

@Composable
private fun WidgetMessage(text: String, color: Color) {
    Text(text, style = TextStyle(color = ColorProvider(color), fontSize = 12.sp))
}

private fun proximity(item: UpcomingBirthday): String = when (item.daysRemaining) {
    0L -> "Avui"
    1L -> "Demà"
    in 2L..6L -> "${item.daysRemaining} dies"
    else -> item.nextDate.format(DateTimeFormatter.ofPattern("d MMM", Locale.forLanguageTag("ca")))
}
