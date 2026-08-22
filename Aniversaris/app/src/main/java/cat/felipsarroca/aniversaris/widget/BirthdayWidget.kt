package cat.felipsarroca.aniversaris.widget

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.LocalContext
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.appWidgetBackground
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.updateAll
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Box
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

class BirthdayWidget : GlanceAppWidget() {
    override val sizeMode: SizeMode = SizeMode.Responsive(setOf(COMPACT, EXPANDED))

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val app = context.applicationContext as AniversarisApplication
        val hasPermission = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED
        val birthdays = if (hasPermission) app.container.repository.getUpcoming(LocalDate.now()) else emptyList()
        val prefs = app.container.preferences.current()
        val systemDark = context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES
        val dark = when (prefs.widgetTheme) { "DARK" -> true; "LIGHT" -> false; else -> systemDark }
        provideContent { WidgetContent(hasPermission, birthdays, dark, prefs.widgetAlpha, prefs.showAvatars) }
    }

    companion object {
        private val COMPACT = DpSize(250.dp, 80.dp)
        private val EXPANDED = DpSize(250.dp, 160.dp)
        suspend fun updateAll(context: Context) = BirthdayWidget().updateAll(context)
    }
}

class BirthdayWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = BirthdayWidget()
}

@Composable
private fun WidgetContent(hasPermission: Boolean, birthdays: List<UpcomingBirthday>, dark: Boolean, alpha: Float, showAvatars: Boolean) {
    val context = LocalContext.current
    val expanded = LocalSize.current.height >= 120.dp
    val maxRows = if (expanded) 8 else 4
    val background = if (dark) android.graphics.Color.argb((alpha * 255).roundToInt(), 20, 17, 16)
    else android.graphics.Color.argb((alpha * 255).roundToInt(), 255, 250, 248)
    val primaryText = if (dark) Color.White else Color(0xFF2A1915)
    val secondaryText = if (dark) Color(0xFFDDD5D1) else Color(0xFF6F5A54)
    Column(
        modifier = GlanceModifier.fillMaxSize().appWidgetBackground()
            .background(ColorProvider(Color(background))).cornerRadius(20.dp)
            .padding(horizontal = 12.dp, vertical = if (expanded) 10.dp else 7.dp)
            .clickable(actionStartActivity(Intent(context, MainActivity::class.java))),
    ) {
        if (expanded) {
            Text("Avui i pròxims", style = TextStyle(color = ColorProvider(primaryText), fontWeight = FontWeight.Bold, fontSize = 13.sp))
            Spacer(GlanceModifier.height(4.dp))
        }
        when {
            !hasPermission -> WidgetMessage("Dona accés als contactes", primaryText)
            birthdays.isEmpty() -> WidgetMessage("Obre Aniversaris per preparar el widget", primaryText)
            else -> VisibleBirthdays(birthdays, maxRows, expanded && showAvatars, primaryText, secondaryText)
        }
    }
}

@Composable
private fun VisibleBirthdays(items: List<UpcomingBirthday>, maxRows: Int, showAvatars: Boolean, primaryText: Color, secondaryText: Color) {
    val todayItems = items.takeWhile { it.daysRemaining == 0L }
    val visible = if (todayItems.size > maxRows) todayItems.take(maxRows - 1) else items.take(maxRows)
    visible.forEach { item -> BirthdayRow(item, showAvatars, primaryText, secondaryText) }
    if (todayItems.size > maxRows) {
        Text(
            "+${todayItems.size - (maxRows - 1)} més avui",
            modifier = GlanceModifier.fillMaxWidth(),
            style = TextStyle(color = ColorProvider(Color(0xFFFFA08E)), fontWeight = FontWeight.Bold, fontSize = 12.sp),
        )
    }
}

@Composable
private fun BirthdayRow(item: UpcomingBirthday, showAvatar: Boolean, primaryText: Color, secondaryText: Color) {
    val highlight = item.daysRemaining == 0L
    Row(modifier = GlanceModifier.fillMaxWidth().height(18.dp), verticalAlignment = Alignment.CenterVertically) {
        if (showAvatar) {
            Box(
                modifier = GlanceModifier.size(16.dp).cornerRadius(8.dp).background(ColorProvider(Color(0xFFE86850))),
                contentAlignment = Alignment.Center,
            ) {
                Text(item.displayName.take(1).uppercase(), style = TextStyle(color = ColorProvider(Color.White), fontWeight = FontWeight.Bold, fontSize = 9.sp))
            }
            Spacer(GlanceModifier.width(5.dp))
        }
        Text(
            item.displayName,
            modifier = GlanceModifier.width(if (showAvatar) 89.dp else 110.dp),
            maxLines = 1,
            style = TextStyle(
                color = ColorProvider(primaryText),
                fontWeight = if (highlight) FontWeight.Bold else FontWeight.Normal,
                fontSize = 12.sp,
            ),
        )
        Text(
            proximity(item),
            modifier = GlanceModifier.width(58.dp),
            maxLines = 1,
            style = TextStyle(color = ColorProvider(if (highlight) Color(0xFFE86850) else secondaryText), fontSize = 11.sp, textAlign = TextAlign.End),
        )
        Text(
            item.ageTurning?.let { "$it anys" } ?: "—",
            modifier = GlanceModifier.width(52.dp),
            maxLines = 1,
            style = TextStyle(color = ColorProvider(secondaryText), fontSize = 11.sp, textAlign = TextAlign.End),
        )
    }
}

@Composable
private fun WidgetMessage(text: String, color: Color) {
    Text(text, style = TextStyle(color = ColorProvider(color), fontSize = 13.sp))
}

private fun proximity(item: UpcomingBirthday): String = when (item.daysRemaining) {
    0L -> "Avui"
    1L -> "Demà"
    in 2L..6L -> "${item.daysRemaining} dies"
    else -> item.nextDate.format(DateTimeFormatter.ofPattern("d MMM", Locale.forLanguageTag("ca")))
}
