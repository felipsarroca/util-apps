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
import cat.felipsarroca.aniversaris.widget.BirthdayWidget
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.LocalDate

data class MainUiState(
    val hasPermission: Boolean = false,
    val onboardingCompleted: Boolean = false,
    val accounts: List<ContactAccount> = emptyList(),
    val selectedAccount: ContactAccount? = null,
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
)

class MainViewModel(application: Application) : AndroidViewModel(application) {
    private val app = application as AniversarisApplication
    private val container = app.container
    private val mutable = MutableStateFlow(MainUiState())
    val state: StateFlow<MainUiState> = combine(
        mutable,
        container.preferences.values,
        container.repository.observeUpcoming(LocalDate.now()),
    ) { local, prefs, birthdays ->
        val filtered = if (local.query.isBlank()) birthdays else birthdays.filter {
            BirthdayNormalizer.normalizeName(it.displayName).contains(BirthdayNormalizer.normalizeName(local.query))
        }
        local.copy(
            onboardingCompleted = prefs.onboardingCompleted,
            selectedAccount = prefs.selectedAccount,
            birthdays = filtered,
            lastRefreshAt = prefs.lastRefreshAt,
            widgetAlpha = prefs.widgetAlpha,
            widgetTheme = prefs.widgetTheme,
            showAvatars = prefs.showAvatars,
            leapDayRule = prefs.leapDayRule,
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), MainUiState())

    init { permissionStateChanged() }

    fun permissionStateChanged() {
        val granted = ContextCompat.checkSelfPermission(app, Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED
        mutable.value = mutable.value.copy(hasPermission = granted, exactAlarmGranted = DayChangeScheduler(app).hasExactAlarmAccess())
        if (granted) loadAccountsAndRefresh() else viewModelScope.launch { container.repository.clearSensitiveCache() }
    }

    fun completePrivacyStep() = viewModelScope.launch { container.preferences.setOnboardingComplete() }

    fun setQuery(value: String) { mutable.value = mutable.value.copy(query = value) }

    fun selectAccount(account: ContactAccount) = viewModelScope.launch {
        container.preferences.setAccount(account)
        refresh(RefreshReason.ACCOUNT_CHANGED)
    }

    fun setWidgetAlpha(value: Float) = viewModelScope.launch {
        container.preferences.setWidgetAlpha(value)
        BirthdayWidget.updateAll(app)
    }

    fun setWidgetTheme(value: String) = viewModelScope.launch {
        container.preferences.setWidgetTheme(value)
        BirthdayWidget.updateAll(app)
    }

    fun setShowAvatars(value: Boolean) = viewModelScope.launch {
        container.preferences.setShowAvatars(value)
        BirthdayWidget.updateAll(app)
    }

    fun setLeapRule(value: cat.felipsarroca.aniversaris.domain.birthdays.LeapDayRule) = viewModelScope.launch {
        container.preferences.setLeapRule(value)
        BirthdayWidget.updateAll(app)
    }

    fun checkUpdates() = viewModelScope.launch {
        mutable.value = mutable.value.copy(updateMessage = "Comprovant…", updateUrl = null)
        val result = cat.felipsarroca.aniversaris.updates.UpdateProviderFactory.create(app).check()
        mutable.value = mutable.value.copy(
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
        BirthdayWidget.updateAll(app)
    }

    private fun loadAccountsAndRefresh() = viewModelScope.launch {
        val accounts = runCatching { container.contactsDataSource.listAccounts() }.getOrDefault(emptyList())
        mutable.value = mutable.value.copy(accounts = accounts)
        val prefs = container.preferences.current()
        val selected = prefs.selectedAccount?.takeIf(accounts::contains)
            ?: accounts.firstOrNull { it.name.equals(PREFERRED_ACCOUNT, true) && it.type == "com.google" }
            ?: accounts.firstOrNull { it.type == "com.google" }
            ?: accounts.firstOrNull()
        if (selected != null && selected != prefs.selectedAccount) container.preferences.setAccount(selected)
        if (selected != null) refresh(RefreshReason.APP_OPEN)
    }

    private companion object { const val PREFERRED_ACCOUNT = "felip.sarroca@gmail.com" }
}
