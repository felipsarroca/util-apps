package cat.felipsarroca.aniversaris.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

private val LightColors = lightColorScheme(
    primary = Color(0xFF8A392E),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFFFDAD3),
    tertiary = Color(0xFF9A452F),
    tertiaryContainer = Color(0xFFFFDACE),
    background = Color(0xFFFFF8F6),
    surface = Color(0xFFFFF8F6),
    surfaceVariant = Color(0xFFF6E6E1),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFFFFB4A5),
    primaryContainer = Color(0xFF6D231B),
    tertiary = Color(0xFFFFB59F),
    tertiaryContainer = Color(0xFF78301F),
    background = Color(0xFF171210),
    surface = Color(0xFF171210),
    surfaceVariant = Color(0xFF302522),
)

@Composable
fun AniversarisTheme(content: @Composable () -> Unit) {
    val dark = isSystemInDarkTheme()
    val context = LocalContext.current
    val colors = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        if (dark) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
    } else if (dark) DarkColors else LightColors
    MaterialTheme(colorScheme = colors, content = content)
}
