package cat.felipsarroca.aniversaris

import android.Manifest
import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.ContactsContract
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.AccountCircle
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Info
import androidx.compose.material.icons.rounded.MoreVert
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Security
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material.icons.rounded.SystemUpdateAlt
import androidx.compose.material.icons.rounded.Widgets
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withLink
import androidx.compose.ui.unit.dp
import androidx.core.net.toUri
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import cat.felipsarroca.aniversaris.domain.birthdays.ContactAccount
import cat.felipsarroca.aniversaris.domain.birthdays.LeapDayRule
import cat.felipsarroca.aniversaris.domain.birthdays.UpcomingBirthday
import cat.felipsarroca.aniversaris.ui.theme.AniversarisTheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.text.DateFormat
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Date
import java.util.Locale
import kotlin.math.roundToInt

class MainActivity : ComponentActivity() {
    private val viewModel: MainViewModel by viewModels()
    private val contactsPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) {
        viewModel.permissionStateChanged()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val state by viewModel.state.collectAsStateWithLifecycle()
            AniversarisTheme { App(state) }
        }
    }

    override fun onResume() {
        super.onResume()
        viewModel.permissionStateChanged()
    }

    @Composable
    private fun App(state: MainUiState) {
        when {
            !state.onboardingCompleted -> WelcomeScreen {
                viewModel.completePrivacyStep()
                contactsPermission.launch(Manifest.permission.READ_CONTACTS)
            }
            !state.hasPermission -> PermissionScreen { contactsPermission.launch(Manifest.permission.READ_CONTACTS) }
            state.selectedAccount == null || !state.accountConfirmed -> AccountScreen(state.accounts, viewModel::selectAccount)
            else -> BirthdayHome(state)
        }
    }

    @Composable
    private fun BirthdayHome(state: MainUiState) {
        var screen by remember { mutableStateOf("list") }
        when (screen) {
            "settings" -> SettingsScreen(state, onBack = { screen = "list" }, onAccount = viewModel::selectAccount)
            "about" -> AboutScreen { screen = "list" }
            else -> BirthdayListScreen(state, onSettings = { screen = "settings" }, onAbout = { screen = "about" })
        }
    }

    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    private fun BirthdayListScreen(state: MainUiState, onSettings: () -> Unit, onAbout: () -> Unit) {
        var searching by remember { mutableStateOf(false) }
        var showDatePicker by remember { mutableStateOf(false) }
        var menu by remember { mutableStateOf(false) }
        Scaffold(
            containerColor = Color.Transparent,
            topBar = {
                Column {
                    TopAppBar(
                        title = {
                            Column {
                                Text("Aniversaris", fontWeight = FontWeight.Bold)
                                Text(state.selectedAccount?.name.orEmpty(), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        },
                        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface.copy(alpha = .96f)),
                        actions = {
                            IconButton(onClick = { searching = !searching }) { Icon(Icons.Rounded.Search, "Cerca") }
                            IconButton(onClick = { showDatePicker = true }) { Icon(Icons.Rounded.CalendarMonth, "Comença en una data") }
                            IconButton(onClick = onSettings) { Icon(Icons.Rounded.Widgets, "Configura els widgets") }
                            Box {
                                IconButton(onClick = { menu = true }) { Icon(Icons.Rounded.MoreVert, "Més opcions") }
                                DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                                    DropdownMenuItem(text = { Text("Ajustos") }, leadingIcon = { Icon(Icons.Rounded.Settings, null) }, onClick = { menu = false; onSettings() })
                                    DropdownMenuItem(text = { Text("Quant a") }, leadingIcon = { Icon(Icons.Rounded.Info, null) }, onClick = { menu = false; onAbout() })
                                }
                            }
                        },
                    )
                    if (searching) TextField(
                        value = state.query,
                        onValueChange = viewModel::setQuery,
                        placeholder = { Text("Cerca per nom") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
                    )
                }
            },
        ) { padding ->
            Column(
                Modifier.fillMaxSize().padding(padding).background(
                    Brush.verticalGradient(listOf(MaterialTheme.colorScheme.surface, MaterialTheme.colorScheme.primaryContainer.copy(alpha = .18f))),
                ),
            ) {
                StatusLine(state, onSettings)
                WidgetSpotlight(onSettings)
                if (state.displayFrom != LocalDate.now()) DateFocusBanner(state.displayFrom) { viewModel.setDisplayFrom(LocalDate.now()) }
                when {
                    state.loading && state.birthdays.isEmpty() -> LoadingState()
                    state.birthdays.isEmpty() -> EmptyState()
                    else -> BirthdayList(state.birthdays, state.displayFrom)
                }
            }
        }
        if (showDatePicker) DateChooser(onDismiss = { showDatePicker = false }) { date ->
            showDatePicker = false
            viewModel.setDisplayFrom(date)
        }
    }

    @Composable
    private fun StatusLine(state: MainUiState, onAccount: () -> Unit) {
        Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 10.dp, top = 6.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            val updated = state.lastRefreshAt?.let { DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(Date(it)) }
            OutlinedButton(onClick = onAccount, contentPadding = PaddingValues(horizontal = 10.dp, vertical = 0.dp)) {
                Icon(Icons.Rounded.AccountCircle, null, Modifier.size(17.dp))
                Spacer(Modifier.width(5.dp))
                Text("Canvia de compte", style = MaterialTheme.typography.labelMedium)
            }
            Spacer(Modifier.weight(1f))
            Text(updated?.let { "Actualitzat $it" } ?: "Sense actualitzar", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (state.loading) CircularProgressIndicator(Modifier.padding(10.dp).size(18.dp), strokeWidth = 2.dp)
            else IconButton(onClick = { viewModel.refresh() }) { Icon(Icons.Rounded.Refresh, "Actualitza contactes") }
        }
        state.message?.let { Text(it, Modifier.padding(horizontal = 20.dp, vertical = 3.dp), color = MaterialTheme.colorScheme.tertiary, style = MaterialTheme.typography.bodySmall) }
    }

    @Composable
    private fun WidgetSpotlight(onSettings: () -> Unit) {
        Card(
            onClick = onSettings,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 5.dp),
            shape = RoundedCornerShape(22.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
        ) {
            Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Surface(shape = CircleShape, color = MaterialTheme.colorScheme.primary) {
                    Icon(Icons.Rounded.Widgets, null, Modifier.padding(10.dp).size(25.dp), tint = MaterialTheme.colorScheme.onPrimary)
                }
                Spacer(Modifier.width(13.dp))
                Column(Modifier.weight(1f)) {
                    Text("Tria el teu widget", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text("3×1 compacte o 4×1 amb més espai per als noms", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onPrimaryContainer)
                }
                Text("Configura", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
            }
        }
    }

    @Composable
    private fun DateFocusBanner(date: LocalDate, onToday: () -> Unit) {
        Surface(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp), color = MaterialTheme.colorScheme.tertiaryContainer, shape = RoundedCornerShape(14.dp)) {
            Row(Modifier.padding(horizontal = 14.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("Mostrant des del ${date.format(DateTimeFormatter.ofPattern("d MMMM yyyy", Locale.forLanguageTag("ca")))}", Modifier.weight(1f), style = MaterialTheme.typography.bodySmall)
                TextButton(onClick = onToday) { Text("Avui") }
            }
        }
    }

    @Composable
    private fun BirthdayList(birthdays: List<UpcomingBirthday>, displayFrom: LocalDate) {
        val grouped = birthdays.groupBy { it.nextDate }
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 32.dp)) {
            grouped.forEach { (date, people) ->
                stickyHeader { DateHeader(date, displayFrom) }
                items(people, key = { it.id }) { BirthdayRow(it, displayFrom) }
            }
        }
    }

    @Composable
    private fun DateHeader(date: LocalDate, displayFrom: LocalDate) {
        val today = LocalDate.now()
        val title = when {
            date == today -> "Avui"
            date == today.plusDays(1) -> "Demà"
            date == displayFrom && displayFrom != today -> "Data escollida · ${date.format(DateTimeFormatter.ofPattern("d MMMM", Locale.forLanguageTag("ca")))}"
            else -> date.format(DateTimeFormatter.ofLocalizedDate(FormatStyle.FULL).withLocale(Locale.forLanguageTag("ca"))).replaceFirstChar { it.uppercase() }
        }
        Surface(color = if (date == displayFrom) MaterialTheme.colorScheme.tertiaryContainer else MaterialTheme.colorScheme.surfaceContainer) {
            Text(title, Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 9.dp), fontWeight = FontWeight.SemiBold, color = if (date == displayFrom) MaterialTheme.colorScheme.onTertiaryContainer else MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }

    @Composable
    private fun BirthdayRow(person: UpcomingBirthday, displayFrom: LocalDate) {
        val context = LocalContext.current
        Row(
            Modifier.fillMaxWidth().clickable(enabled = person.lookupKey != null) {
                person.lookupKey?.let { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.withAppendedPath(ContactsContract.Contacts.CONTENT_LOOKUP_URI, it))) }
            }.padding(horizontal = 20.dp, vertical = 11.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            ContactAvatar(person)
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(person.displayName, maxLines = 1, overflow = TextOverflow.Ellipsis, fontWeight = if (person.nextDate == displayFrom) FontWeight.Bold else FontWeight.Medium)
                Text(proximityText(person, displayFrom), style = MaterialTheme.typography.bodySmall, color = if (person.nextDate == displayFrom) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.onSurfaceVariant)
            }
            person.ageTurning?.let { Text("$it anys", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
        HorizontalDivider(Modifier.padding(start = 78.dp), color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = .45f))
    }

    @Composable
    private fun ContactAvatar(person: UpcomingBirthday) {
        val context = LocalContext.current
        val photo: ImageBitmap? by produceState(initialValue = null, key1 = person.photoThumbnailUri) {
            value = person.photoThumbnailUri?.let { uri ->
                withContext(Dispatchers.IO) {
                    runCatching { context.contentResolver.openInputStream(uri.toUri())?.use { BitmapFactory.decodeStream(it) }?.asImageBitmap() }.getOrNull()
                }
            }
        }
        if (photo != null) Image(photo!!, person.displayName, Modifier.size(44.dp).clip(CircleShape), contentScale = ContentScale.Crop)
        else Monogram(person.displayName)
    }

    @Composable
    private fun Monogram(name: String) {
        Box(Modifier.size(44.dp).clip(CircleShape).background(monogramColor(name)), contentAlignment = Alignment.Center) {
            Text(name.trim().take(1).uppercase(), fontWeight = FontWeight.Bold, color = Color.White)
        }
    }

    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    private fun DateChooser(onDismiss: () -> Unit, onDate: (LocalDate) -> Unit) {
        val picker = rememberDatePickerState(initialSelectedDateMillis = System.currentTimeMillis())
        DatePickerDialog(onDismissRequest = onDismiss, confirmButton = {
            TextButton(onClick = {
                val selected = picker.selectedDateMillis ?: return@TextButton
                onDate(Instant.ofEpochMilli(selected).atZone(ZoneId.of("UTC")).toLocalDate())
            }) { Text("Mostra des d’aquí") }
        }, dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel·la") } }) { DatePicker(picker) }
    }

    @Composable
    private fun SettingsScreen(state: MainUiState, onBack: () -> Unit, onAccount: (ContactAccount) -> Unit) {
        var accountsOpen by remember { mutableStateOf(false) }
        var sliderTransparency by remember(state.widgetAlpha) { mutableFloatStateOf(1f - state.widgetAlpha) }
        val context = LocalContext.current
        Scaffold(topBar = { SimpleTopBar("Ajustos", onBack) }) { padding ->
            LazyColumn(
                Modifier.fillMaxSize().padding(padding).background(MaterialTheme.colorScheme.surfaceContainerLow),
                contentPadding = PaddingValues(16.dp, 12.dp, 16.dp, 32.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                item {
                    SettingsCard(
                        Icons.Rounded.SystemUpdateAlt,
                        "Actualitzacions de l’app",
                        containerColor = if (state.updateUrl != null) MaterialTheme.colorScheme.tertiaryContainer else MaterialTheme.colorScheme.primaryContainer,
                    ) {
                        Text("Versió ${BuildConfig.VERSION_NAME} · canal ${BuildConfig.UPDATE_SOURCE}", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(
                            state.updateMessage ?: "L’app comprova automàticament si hi ha una versió nova quan s’inicia.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        state.updateUrl?.let { url ->
                            Button(onClick = { context.startActivity(Intent(Intent.ACTION_VIEW, url.toUri())) }, modifier = Modifier.fillMaxWidth()) {
                                Icon(Icons.Rounded.SystemUpdateAlt, null)
                                Spacer(Modifier.width(8.dp))
                                Text("Descarrega i instal·la l’actualització")
                            }
                        }
                        OutlinedButton(onClick = viewModel::checkUpdates, enabled = !state.checkingUpdates, modifier = Modifier.fillMaxWidth()) {
                            if (state.checkingUpdates) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                            else Icon(Icons.Rounded.Refresh, null)
                            Spacer(Modifier.width(8.dp))
                            Text(if (state.checkingUpdates) "Comprovant…" else "Torna a cercar actualitzacions")
                        }
                        Text("La comprovació es fa en segon pla i no alenteix l’obertura. No s’hi envia cap dada dels contactes.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                item {
                    SettingsCard(Icons.Rounded.Widgets, "Widget") {
                        Text("Afegeix des del selector de widgets del mòbil la modalitat Aniversaris 3×1 o Aniversaris 4×1. Totes dues mostren exactament quatre aniversaris.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            WidgetSizeOption("3×1", "Compacte", Modifier.weight(1f))
                            WidgetSizeOption("4×1", "Noms més amplis", Modifier.weight(1f))
                        }
                        WidgetPreview(state.widgetTheme, 1f - sliderTransparency)
                        Text("Transparència · ${(sliderTransparency * 100).roundToInt()}%", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                        Slider(
                            value = sliderTransparency,
                            onValueChange = { sliderTransparency = it },
                            onValueChangeFinished = { viewModel.setWidgetAlpha(1f - sliderTransparency) },
                            valueRange = 0f..1f,
                        )
                        Text("Color", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                        Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                            listOf("SYSTEM" to "Sistema", "DARK" to "Fosc", "LIGHT" to "Clar").forEach { (value, label) ->
                                FilterChip(
                                    selected = state.widgetTheme == value,
                                    onClick = { viewModel.setWidgetTheme(value) },
                                    label = { Text(label) },
                                    leadingIcon = { if (state.widgetTheme == value) Icon(Icons.Rounded.Check, null, Modifier.size(16.dp)) },
                                )
                            }
                        }
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text("Fotos dels contactes", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                                Text("Mostra la foto o, si no n’hi ha, la inicial.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            Switch(checked = state.showAvatars, onCheckedChange = viewModel::setShowAvatars)
                        }
                    }
                }
                item {
                    SettingsCard(Icons.Rounded.AccountCircle, "Compte de Google") {
                        Text("Només es llegeixen les dates dels contactes del compte seleccionat.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Box {
                            OutlinedButton(onClick = { accountsOpen = true }, modifier = Modifier.fillMaxWidth()) { Text(state.selectedAccount?.name ?: "Tria un compte", maxLines = 1, overflow = TextOverflow.Ellipsis) }
                            DropdownMenu(accountsOpen, { accountsOpen = false }) {
                                state.accounts.forEach { account -> DropdownMenuItem(
                                    text = { Column { Text(account.name); Text(accountLabel(account), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) } },
                                    trailingIcon = { if (account == state.selectedAccount) Icon(Icons.Rounded.Check, null) },
                                    onClick = { accountsOpen = false; onAccount(account) },
                                ) }
                            }
                        }
                    }
                }
                item {
                    SettingsCard(Icons.Rounded.Schedule, "Actualització del dia") {
                        Text(if (state.exactAlarmGranted) "Alarma exacta disponible." else "L’actualització pot arribar uns minuts tard.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        if (!state.exactAlarmGranted) TextButton(onClick = {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) context.startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, "package:${context.packageName}".toUri()))
                        }) { Text("Permet alarmes i recordatoris") }
                    }
                }
                item {
                    SettingsCard(Icons.Rounded.CalendarMonth, "Aniversaris del 29 de febrer") {
                        Text("Tria quan es mostraran en anys no bixests.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            FilterChip(selected = state.leapDayRule == LeapDayRule.FEB_28, onClick = { viewModel.setLeapRule(LeapDayRule.FEB_28) }, label = { Text("28 de febrer") })
                            FilterChip(selected = state.leapDayRule == LeapDayRule.MAR_1, onClick = { viewModel.setLeapRule(LeapDayRule.MAR_1) }, label = { Text("1 de març") })
                        }
                    }
                }
                item {
                    SettingsCard(Icons.Rounded.Security, "Privadesa") {
                        Text("Només es llegeixen el nom, les dates desades i la miniatura del compte triat. Tot es processa al dispositiu.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }

    @Composable
    private fun SettingsCard(
        icon: androidx.compose.ui.graphics.vector.ImageVector,
        title: String,
        containerColor: Color = MaterialTheme.colorScheme.surface,
        content: @Composable ColumnScope.() -> Unit,
    ) {
        Card(shape = RoundedCornerShape(24.dp), colors = CardDefaults.cardColors(containerColor = containerColor)) {
            Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(11.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Surface(shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.secondaryContainer) {
                        Icon(icon, null, Modifier.padding(8.dp).size(21.dp), tint = MaterialTheme.colorScheme.onSecondaryContainer)
                    }
                    Spacer(Modifier.width(11.dp))
                    Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                }
                content()
            }
        }
    }

    @Composable
    private fun WidgetPreview(theme: String, alpha: Float) {
        val dark = theme == "DARK" || (theme == "SYSTEM" && androidx.compose.foundation.isSystemInDarkTheme())
        val background = if (dark) Color(0xFF171210).copy(alpha = alpha) else Color(0xFFFFFAF8).copy(alpha = alpha)
        val foreground = if (dark) Color.White else Color(0xFF2A1915)
        Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(MaterialTheme.colorScheme.primaryContainer.copy(alpha = .35f)).padding(8.dp)) {
            Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(15.dp)).background(background).padding(horizontal = 12.dp, vertical = 7.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                listOf("Anna Puig" to "Avui", "Jordi Serra" to "Demà", "Marta Soler" to "3 dies", "Pau Costa" to "12 set.").forEach { (name, date) ->
                    Row(Modifier.fillMaxWidth()) {
                        Text(name, Modifier.weight(1f), style = MaterialTheme.typography.labelSmall, color = foreground)
                        Text(date, style = MaterialTheme.typography.labelSmall, color = foreground.copy(alpha = .72f))
                    }
                }
            }
        }
    }

    @Composable
    private fun WidgetSizeOption(size: String, description: String, modifier: Modifier = Modifier) {
        Surface(modifier, shape = RoundedCornerShape(15.dp), color = MaterialTheme.colorScheme.secondaryContainer) {
            Column(Modifier.padding(12.dp)) {
                Text(size, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text(description, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSecondaryContainer)
            }
        }
    }

    @Composable
    private fun AboutScreen(onBack: () -> Unit) {
        val uri = LocalUriHandler.current
        Scaffold(topBar = { SimpleTopBar("Quant a", onBack) }) { padding ->
            Column(Modifier.fillMaxSize().padding(padding).padding(24.dp), verticalArrangement = Arrangement.SpaceBetween) {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Aniversaris", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                    Text("Un visor privat i local dels aniversaris dels teus contactes, amb widgets 3×1 i 4×1.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("Versió ${BuildConfig.VERSION_NAME}", style = MaterialTheme.typography.labelLarge)
                }
                FelipFooter(uri::openUri)
            }
        }
    }

    @Composable
    private fun FelipFooter(open: (String) -> Unit) {
        Surface(Modifier.fillMaxWidth().navigationBarsPadding(), shape = RoundedCornerShape(16.dp), color = MaterialTheme.colorScheme.surfaceVariant) {
            Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                Image(painterResource(R.drawable.cc_by_nc_sa), "Llicència Creative Commons BY-NC-SA 4.0", Modifier.width(78.dp).clickable { open(CC_URL) }, contentScale = ContentScale.FillWidth)
                Spacer(Modifier.width(10.dp))
                Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    val linkStyle = SpanStyle(color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
                    Text(buildAnnotatedString {
                        append("Aplicació creada per ")
                        withLink(LinkAnnotation.Url(AUTHOR_URL, TextLinkStyles(style = linkStyle))) { append("Felip Sarroca") }
                    }, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(buildAnnotatedString {
                        append("Obra sota llicència ")
                        withLink(LinkAnnotation.Url(CC_URL, TextLinkStyles(style = linkStyle))) { append("CC BY-NC-SA 4.0") }
                    }, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }

    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    private fun SimpleTopBar(title: String, onBack: () -> Unit) = TopAppBar(
        title = { Text(title, fontWeight = FontWeight.Bold) },
        navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Enrere") } },
    )

    @Composable private fun LoadingState() = Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
    @Composable private fun EmptyState() = Box(Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) { Text("Aquest compte no té aniversaris desats.", color = MaterialTheme.colorScheme.onSurfaceVariant) }

    private fun proximityText(person: UpcomingBirthday, displayFrom: LocalDate): String = when {
        person.nextDate == displayFrom && displayFrom == LocalDate.now() -> "Avui"
        person.nextDate == displayFrom -> "Data escollida"
        displayFrom != LocalDate.now() && person.daysRemaining == 1L -> "L’endemà"
        displayFrom != LocalDate.now() -> "${person.daysRemaining} dies després"
        person.daysRemaining == 1L -> "Demà"
        else -> "D’aquí a ${person.daysRemaining} dies"
    }

    private fun accountLabel(account: ContactAccount) = if (account.type.equals("com.google", true)) "Compte de Google" else account.type
    private fun monogramColor(name: String): Color = listOf(Color(0xFFE86850), Color(0xFF5C6BC0), Color(0xFF00897B), Color(0xFF9C5A9C))[kotlin.math.abs(name.hashCode()) % 4]

    private companion object {
        const val AUTHOR_URL = "https://ja.cat/felipsarroca"
        const val CC_URL = "https://creativecommons.org/licenses/by-nc-sa/4.0/deed.ca"
    }
}

@Composable
private fun WelcomeScreen(onContinue: () -> Unit) {
    Surface(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize().padding(28.dp), verticalArrangement = Arrangement.SpaceBetween) {
            Column(verticalArrangement = Arrangement.spacedBy(18.dp)) {
                Box(Modifier.size(72.dp).clip(RoundedCornerShape(22.dp)).background(MaterialTheme.colorScheme.tertiaryContainer), contentAlignment = Alignment.Center) {
                    Icon(Icons.Rounded.CalendarMonth, null, Modifier.size(38.dp), tint = MaterialTheme.colorScheme.tertiary)
                }
                Text("Els aniversaris, a mà", style = MaterialTheme.typography.displaySmall, fontWeight = FontWeight.Bold)
                Text("Consulta els aniversaris dels teus contactes i mira els quatre més pròxims directament des d’un widget 3×1 o 4×1.", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Card { Text("L’app et demanarà quin compte de Google vols consultar. Només llegirà el nom, l’aniversari i la foto; tot es processarà al telèfon.", Modifier.padding(18.dp)) }
            }
            Button(onClick = onContinue, modifier = Modifier.fillMaxWidth().height(54.dp)) { Text("Continua") }
        }
    }
}

@Composable
private fun PermissionScreen(onRequest: () -> Unit) = StateScreen(
    "Dona accés als contactes",
    "Sense aquest permís no podem trobar els aniversaris. Si l’havies concedit i l’has revocat, la memòria cau local ja s’ha esborrat.",
    "Dona accés",
    onRequest,
)

@Composable
private fun AccountScreen(accounts: List<ContactAccount>, onSelect: (ContactAccount) -> Unit) {
    Column(Modifier.fillMaxSize().padding(28.dp), verticalArrangement = Arrangement.Center) {
        Icon(Icons.Rounded.AccountCircle, null, Modifier.size(50.dp), tint = MaterialTheme.colorScheme.primary)
        Spacer(Modifier.height(16.dp))
        Text("Tria un compte de Google", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text("Només es mostraran els aniversaris vinculats al compte que seleccionis. Ho podràs canviar després als ajustos.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(20.dp))
        if (accounts.isEmpty()) Text("No s’ha trobat cap compte amb contactes. Comprova que Google Contacts estigui sincronitzat.")
        accounts.forEach { account ->
            Card(onClick = { onSelect(account) }, Modifier.fillMaxWidth().padding(vertical = 5.dp), shape = RoundedCornerShape(18.dp)) {
                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Rounded.AccountCircle, null, tint = MaterialTheme.colorScheme.primary)
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text(account.name, fontWeight = FontWeight.SemiBold)
                        Text(if (account.type.equals("com.google", true)) "Compte de Google" else account.type, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
}

@Composable
private fun StateScreen(title: String, body: String, action: String, onClick: () -> Unit) {
    Column(Modifier.fillMaxSize().padding(28.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(Icons.Rounded.Info, null, Modifier.size(48.dp), tint = MaterialTheme.colorScheme.tertiary)
        Spacer(Modifier.height(18.dp))
        Text(title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(10.dp))
        Text(body, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(22.dp))
        Button(onClick = onClick) { Text(action) }
    }
}
