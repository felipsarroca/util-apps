package cat.felipsarroca.aniversaris

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Build
import android.provider.ContactsContract
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.core.net.toUri
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Info
import androidx.compose.material.icons.rounded.MoreVert
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import cat.felipsarroca.aniversaris.domain.birthdays.ContactAccount
import cat.felipsarroca.aniversaris.domain.birthdays.LeapDayRule
import cat.felipsarroca.aniversaris.domain.birthdays.UpcomingBirthday
import cat.felipsarroca.aniversaris.ui.theme.AniversarisTheme
import java.text.DateFormat
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Date
import java.util.Locale

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
            state.selectedAccount == null -> AccountScreen(state.accounts, viewModel::selectAccount)
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
        var targetDate by remember { mutableStateOf<LocalDate?>(null) }
        var menu by remember { mutableStateOf(false) }
        Scaffold(
            topBar = {
                Column {
                    TopAppBar(
                        title = { Text("Aniversaris", fontWeight = FontWeight.Bold) },
                        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface),
                        actions = {
                            IconButton(onClick = { searching = !searching }) { Icon(Icons.Rounded.Search, "Cerca") }
                            IconButton(onClick = { showDatePicker = true }) { Icon(Icons.Rounded.CalendarMonth, "Ves a una data") }
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
            Column(Modifier.fillMaxSize().padding(padding)) {
                StatusLine(state)
                when {
                    state.loading && state.birthdays.isEmpty() -> LoadingState()
                    state.birthdays.isEmpty() -> EmptyState()
                    else -> BirthdayList(state.birthdays, targetDate)
                }
            }
        }
        if (showDatePicker) DateChooser(onDismiss = { showDatePicker = false }) { date ->
            showDatePicker = false
            viewModel.setQuery("")
            targetDate = date
        }
    }

    @Composable
    private fun StatusLine(state: MainUiState) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            val updated = state.lastRefreshAt?.let { DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(Date(it)) }
            Text(updated?.let { "Actualitzat $it" } ?: "Encara no s’ha actualitzat", modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (state.loading) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
            else IconButton(onClick = { viewModel.refresh() }) { Icon(Icons.Rounded.Refresh, "Actualitza") }
        }
        state.message?.let { Text(it, Modifier.padding(horizontal = 20.dp, vertical = 4.dp), color = MaterialTheme.colorScheme.tertiary, style = MaterialTheme.typography.bodySmall) }
    }

    @Composable
    private fun BirthdayList(birthdays: List<UpcomingBirthday>, targetDate: LocalDate?) {
        val grouped = birthdays.groupBy { it.nextDate }
        val listState = rememberLazyListState()
        LaunchedEffect(targetDate, birthdays) {
            if (targetDate != null) {
                var index = 0
                for ((date, people) in grouped) {
                    if (!date.isBefore(targetDate)) break
                    index += 1 + people.size
                }
                listState.animateScrollToItem(index.coerceAtMost((birthdays.size + grouped.size - 1).coerceAtLeast(0)))
            }
        }
        LazyColumn(Modifier.fillMaxSize(), state = listState, contentPadding = androidx.compose.foundation.layout.PaddingValues(bottom = 32.dp)) {
            grouped.forEach { (date, people) ->
                stickyHeader { DateHeader(date) }
                items(people, key = { it.id }) { BirthdayRow(it) }
            }
        }
    }

    @Composable
    private fun DateHeader(date: LocalDate) {
        val today = LocalDate.now()
        val title = when (date) {
            today -> "Avui"
            today.plusDays(1) -> "Demà"
            else -> date.format(DateTimeFormatter.ofLocalizedDate(FormatStyle.FULL).withLocale(Locale.forLanguageTag("ca"))).replaceFirstChar { it.uppercase() }
        }
        Surface(color = if (date == today) MaterialTheme.colorScheme.tertiaryContainer else MaterialTheme.colorScheme.surfaceVariant) {
            Text(title, Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 9.dp), fontWeight = FontWeight.SemiBold, color = if (date == today) MaterialTheme.colorScheme.onTertiaryContainer else MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }

    @Composable
    private fun BirthdayRow(person: UpcomingBirthday) {
        val context = LocalContext.current
        Row(
            Modifier.fillMaxWidth().clickable(enabled = person.lookupKey != null) {
                person.lookupKey?.let {
                    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.withAppendedPath(ContactsContract.Contacts.CONTENT_LOOKUP_URI, it)))
                }
            }.padding(horizontal = 20.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Monogram(person.displayName)
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(person.displayName, maxLines = 1, overflow = TextOverflow.Ellipsis, fontWeight = if (person.daysRemaining == 0L) FontWeight.Bold else FontWeight.Medium)
                Text(proximityText(person), style = MaterialTheme.typography.bodySmall, color = if (person.daysRemaining == 0L) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.onSurfaceVariant)
            }
            person.ageTurning?.let { Text("$it anys", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
        HorizontalDivider(Modifier.padding(start = 74.dp), color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = .45f))
    }

    @Composable
    private fun Monogram(name: String) {
        Box(Modifier.size(40.dp).clip(CircleShape).background(monogramColor(name)), contentAlignment = Alignment.Center) {
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
            }) { Text("Ves-hi") }
        }, dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel·la") } }) { DatePicker(picker) }
    }

    @Composable
    private fun SettingsScreen(state: MainUiState, onBack: () -> Unit, onAccount: (ContactAccount) -> Unit) {
        var accountsOpen by remember { mutableStateOf(false) }
        val context = LocalContext.current
        Scaffold(topBar = { SimpleTopBar("Ajustos", onBack) }) { padding ->
            LazyColumn(Modifier.fillMaxSize().padding(padding), contentPadding = androidx.compose.foundation.layout.PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
                item {
                    SettingTitle("Compte de contactes")
                    Box {
                        OutlinedButton(onClick = { accountsOpen = true }, modifier = Modifier.fillMaxWidth()) { Text(state.selectedAccount?.name ?: "Tria un compte") }
                        DropdownMenu(accountsOpen, { accountsOpen = false }) {
                            state.accounts.forEach { account -> DropdownMenuItem(
                                text = { Text(account.name) },
                                trailingIcon = { if (account == state.selectedAccount) Icon(Icons.Rounded.Check, null) },
                                onClick = { accountsOpen = false; onAccount(account) },
                            ) }
                        }
                    }
                }
                item {
                    SettingTitle("Actualització del dia")
                    Text(if (state.exactAlarmGranted) "Alarma exacta disponible" else "Pot arribar uns minuts tard", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    if (!state.exactAlarmGranted) TextButton(onClick = {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                            context.startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, "package:${context.packageName}".toUri()))
                        }
                    }) { Text("Permet alarmes i recordatoris") }
                }
                item {
                    SettingTitle("Aparença del widget")
                    Text("Transparència: ${(state.widgetAlpha * 100).toInt()}%", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Slider(value = state.widgetAlpha, onValueChange = viewModel::setWidgetAlpha, valueRange = .55f..90f)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf("SYSTEM" to "Sistema", "DARK" to "Fosc", "LIGHT" to "Clar").forEach { (value, label) ->
                            OutlinedButton(onClick = { viewModel.setWidgetTheme(value) }) {
                                if (state.widgetTheme == value) Icon(Icons.Rounded.Check, null, Modifier.size(16.dp))
                                Text(label)
                            }
                        }
                    }
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Text("Mostra avatars al widget ampliat", modifier = Modifier.weight(1f))
                        Switch(checked = state.showAvatars, onCheckedChange = viewModel::setShowAvatars)
                    }
                }
                item {
                    SettingTitle("Aniversaris del 29 de febrer")
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = { viewModel.setLeapRule(LeapDayRule.FEB_28) }) {
                            if (state.leapDayRule == LeapDayRule.FEB_28) Icon(Icons.Rounded.Check, null, Modifier.size(16.dp))
                            Text("28 de febrer")
                        }
                        OutlinedButton(onClick = { viewModel.setLeapRule(LeapDayRule.MAR_1) }) {
                            if (state.leapDayRule == LeapDayRule.MAR_1) Icon(Icons.Rounded.Check, null, Modifier.size(16.dp))
                            Text("1 de març")
                        }
                    }
                }
                item {
                    SettingTitle("Privadesa")
                    Text("Només es llegeixen el nom i la data d’aniversari del compte triat. Tot es processa al dispositiu i no s’envien dades de contactes fora.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                item {
                    SettingTitle("Actualitzacions de l’app")
                    Text("Versió ${BuildConfig.VERSION_NAME} · canal ${BuildConfig.UPDATE_SOURCE}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("El canal GitHub només obrirà una descàrrega després de la teva confirmació.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    TextButton(onClick = viewModel::checkUpdates) { Text("Comprova ara") }
                    state.updateMessage?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    state.updateUrl?.let { url -> Button(onClick = {
                        context.startActivity(Intent(Intent.ACTION_VIEW, url.toUri()))
                    }) { Text("Actualitza") } }
                }
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
                    Text("Un visor privat i local dels aniversaris dels teus contactes, amb un widget pensat per veure avui i els pròxims d’un cop d’ull.", color = MaterialTheme.colorScheme.onSurfaceVariant)
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
                Image(
                    painterResource(R.drawable.cc_by_nc_sa),
                    contentDescription = "Llicència Creative Commons BY-NC-SA 4.0",
                    modifier = Modifier.width(78.dp).clickable { open(CC_URL) },
                    contentScale = ContentScale.FillWidth,
                )
                Spacer(Modifier.width(10.dp))
                Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    val linkStyle = SpanStyle(color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
                    Text(buildAnnotatedString {
                        append("Aplicació creada per ")
                        withLink(LinkAnnotation.Url(AUTHOR_URL, TextLinkStyles(style = linkStyle))) { append("Felip Sarroca") }
                        append(" amb assistència de la IA")
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

    @Composable private fun SettingTitle(text: String) = Text(text, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
    @Composable private fun LoadingState() = Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
    @Composable private fun EmptyState() = Box(Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) { Text("Aquest compte no té aniversaris desats.", color = MaterialTheme.colorScheme.onSurfaceVariant) }

    private fun proximityText(person: UpcomingBirthday): String = when (person.daysRemaining) {
        0L -> "Avui"
        1L -> "Demà"
        else -> "D’aquí a ${person.daysRemaining} dies"
    }

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
                Text("Consulta els aniversaris dels teus contactes i mira els més pròxims directament des del widget.", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Card { Text("Per mostrar-los, l’app necessita llegir el nom i la data d’aniversari dels contactes del compte que triïs. Les dades es processen al telèfon i no s’envien fora.", Modifier.padding(18.dp)) }
            }
            Button(onClick = onContinue, modifier = Modifier.fillMaxWidth().height(54.dp)) { Text("Continua") }
        }
    }
}

@Composable
private fun PermissionScreen(onRequest: () -> Unit) {
    StateScreen("Dona accés als contactes", "Sense aquest permís no podem trobar els aniversaris. Si l’havies concedit i l’has revocat, la memòria cau local ja s’ha esborrat.", "Dona accés", onRequest)
}

@Composable
private fun AccountScreen(accounts: List<ContactAccount>, onSelect: (ContactAccount) -> Unit) {
    Column(Modifier.fillMaxSize().padding(28.dp), verticalArrangement = Arrangement.Center) {
        Text("Tria el compte", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text("Només es mostraran els aniversaris del compte seleccionat.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(20.dp))
        if (accounts.isEmpty()) Text("No s’ha trobat cap compte de contactes compatible.")
        accounts.forEach { account -> OutlinedButton(onClick = { onSelect(account) }, Modifier.fillMaxWidth().padding(vertical = 4.dp)) { Text(account.name) } }
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
