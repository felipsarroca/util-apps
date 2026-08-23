package cat.felipsarroca.aniversaris

import android.Manifest
import android.app.Application
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import cat.felipsarroca.aniversaris.domain.birthdays.BirthdayNormalizer
import cat.felipsarroca.aniversaris.domain.birthdays.ContactAccount
import cat.felipsarroca.aniversaris.domain.birthdays.RefreshReason
import cat.felipsarroca.aniversaris.domain.birthdays.RefreshResult
import cat.felipsarroca.aniversaris.domain.birthdays.UpcomingBirthday
import cat.felipsarroca.aniversaris.scheduling.DayChangeScheduler
import cat.felipsarroca.aniversaris.widget.BirthdayWidgets
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.LocalDate

data class MainUiState(
    val hasPermission: Boolean = false,
    val onboardingCompleted: Boolean = false,
    val accounts: List<ContactAccount> = emptyList(),
    val selectedAccount: ContactAccount? = null,
    val accountConfirmed: Boolean = false,
    val birthdays: List<UpcomingBirthday> = emptyList(),
    val query: String = "",
    val loading: Boolean = false,
    val lastRefreshAt: Long? = null,
    val message: String? = null,
    val exactAlarmGranted: Boolean = false,
    val widgetAlpha: Float = .72f,
    val widgetTheme: String = "SYSTEM",
    val showAvatars: Boolean = true,
    val leapDayRule: cat.felipsarroca.aniversaris.domain.birthdays.LeapDayRule = cat.felipsarroca.aniversaris.domain.birthdays.LeapDayRule.FEB_28,
    val updateMessage: String? = null,
    val updateUrl: String? = null,
    val checkingUpdates: Boolean = false,
    val displayFrom: LocalDate = LocalDate.now(),
)

@OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
class MainViewModel(application: Application) : AndroidViewModel(application) {
    private val app = application as AniversarisApplication
    private val container = app.container
    private val mutable = MutableStateFlow(MainUiState())
    private val birthdaysFromSelectedDate = mutable
        .map { it.displayFrom }
        .distinctUntilChanged()
        .flatMapLatest(container.repository::observeUpcoming)
    val state: StateFlow<MainUiState> = combine(
        mutable,
        container.preferences.values,
        birthdaysFromSelectedDate,
    ) { local, prefs, birthdays ->
        val filtered = if (local.query.isBlank()) birthdays else birthdays.filter {
            BirthdayNormalizer.normalizeName(it.displayName).contains(BirthdayNormalizer.normalizeName(local.query))
        }
        local.copy(
            onboardingCompleted = prefs.onboardingCompleted,
            selectedAccount = prefs.selectedAccount,
            accountConfirmed = prefs.accountConfirmed,
            birthdays = filtered,
            lastRefreshAt = prefs.lastRefreshAt,
            widgetAlpha = prefs.widgetAlpha,
            widgetTheme = prefs.widgetTheme,
            showAvatars = prefs.showAvatars,
            leapDayRule = prefs.leapDayRule,
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), MainUiState())

    init {
        permissionStateChanged()
        performUpdateCheck(automatic = true)
    }

    fun permissionStateChanged() {
        val granted = ContextCompat.checkSelfPermission(app, Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED
        mutable.value = mutable.value.copy(hasPermission = granted, exactAlarmGranted = DayChangeScheduler(app).hasExactAlarmAccess())
        if (granted) loadAccountsAndRefresh() else viewModelScope.launch { container.repository.clearSensitiveCache() }
    }

    fun completePrivacyStep() = viewModelScope.launch { container.preferences.setOnboardingComplete() }

    fun setQuery(value: String) { mutable.value = mutable.value.copy(query = value) }

    fun setDisplayFrom(date: LocalDate) {
        mutable.value = mutable.value.copy(displayFrom = date, query = "")
    }

    fun selectAccount(account: ContactAccount) = viewModelScope.launch {
        container.preferences.setAccount(account)
        refresh(RefreshReason.ACCOUNT_CHANGED)
    }

    fun setWidgetAlpha(value: Float) = viewModelScope.launch {
        container.preferences.setWidgetAlpha(value)
        BirthdayWidgets.updateAll(app)
    }

    fun setWidgetTheme(value: String) = viewModelScope.launch {
        container.preferences.setWidgetTheme(value)
        BirthdayWidgets.updateAll(app)
    }

    fun setShowAvatars(value: Boolean) = viewModelScope.launch {
        container.preferences.setShowAvatars(value)
        BirthdayWidgets.updateAll(app)
    }

    fun setLeapRule(value: cat.felipsarroca.aniversaris.domain.birthdays.LeapDayRule) = viewModelScope.launch {
        container.preferences.setLeapRule(value)
        BirthdayWidgets.updateAll(app)
    }

    fun checkUpdates() = performUpdateCheck(automatic = false)

    private fun performUpdateCheck(automatic: Boolean) = viewModelScope.launch {
        mutable.value = mutable.value.copy(
            checkingUpdates = true,
            updateMessage = if (automatic) "Comprovant automàticament si hi ha actualitzacions…" else "Comprovant…",
            updateUrl = null,
        )
        val result = cat.felipsarroca.aniversaris.updates.UpdateProviderFactory.create(app).check()
        mutable.value = mutable.value.copy(
            checkingUpdates = false,
            updateMessage = when (result) {
                cat.felipsarroca.aniversaris.updates.UpdateCheckResult.UpToDate -> "Ja tens l’última versió."
                cat.felipsarroca.aniversaris.updates.UpdateCheckResult.Offline -> "Sense connexió. Torna-ho a provar més tard."
                cat.felipsarroca.aniversaris.updates.UpdateCheckResult.NotConfigured -> "El repositori d’actualitzacions encara no està configurat."
                is cat.felipsarroca.aniversaris.updates.UpdateCheckResult.Available -> "Hi ha una nova versió: ${result.update.versionName}."
                is cat.felipsarroca.aniversaris.updates.UpdateCheckResult.Error -> "No s’ha pogut comprovar: ${result.message}"
            },
            updateUrl = (result as? cat.felipsarroca.aniversaris.updates.UpdateCheckResult.Available)?.update?.url,
        )
    }

    fun refresh(reason: RefreshReason = RefreshReason.USER) = viewModelScope.launch {
        mutable.value = mutable.value.copy(loading = true, message = null)
        val result = container.repository.refresh(reason)
        val message = when (result) {
            is RefreshResult.Success -> when {
                result.invalidRows > 0 -> "Actualitzat. ${result.invalidRows} dates no s’han pogut interpretar."
                result.duplicatesRemoved > 0 -> "Actualitzat. ${result.duplicatesRemoved} duplicats agrupats."
                else -> null
            }
            RefreshResult.PermissionMissing -> "Cal donar accés als contactes."
            RefreshResult.AccountMissing -> "Tria un compte de contactes."
            is RefreshResult.Error -> "No s’ha pogut actualitzar. Es conserven les últimes dades."
        }
        mutable.value = mutable.value.copy(loading = false, message = message)
        BirthdayWidgets.updateAll(app)
    }

    private fun loadAccountsAndRefresh() = viewModelScope.launch {
        val detected = runCatching { container.contactsDataSource.listAccounts() }.getOrDefault(emptyList())
        val googleAccounts = detected.filter { it.type.equals("com.google", ignoreCase = true) }
        val accounts = googleAccounts.ifEmpty { detected }
        mutable.value = mutable.value.copy(accounts = accounts)
        val prefs = container.preferences.current()
        val selected = prefs.selectedAccount?.takeIf(accounts::contains)
            ?: accounts.firstOrNull { it.name.equals(PREFERRED_ACCOUNT, true) && it.type == "com.google" }
            ?: accounts.firstOrNull { it.type == "com.google" }
            ?: accounts.firstOrNull()
        if (selected != null && selected != prefs.selectedAccount) container.preferences.setAccount(selected, confirmed = false)
        if (selected != null && prefs.accountConfirmed) refresh(RefreshReason.APP_OPEN)
    }

    private companion object { const val PREFERRED_ACCOUNT = "felip.sarroca@gmail.com" }
}
