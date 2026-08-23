package cat.felipsarroca.aniversaris.data.preferences

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.floatPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import cat.felipsarroca.aniversaris.domain.birthdays.ContactAccount
import cat.felipsarroca.aniversaris.domain.birthdays.LeapDayRule
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore("aniversaris_preferences")

data class UserPreferences(
    val selectedAccount: ContactAccount?,
    val accountConfirmed: Boolean,
    val leapDayRule: LeapDayRule,
    val widgetTheme: String,
    val widgetAlpha: Float,
    val showAvatars: Boolean,
    val updateFrequency: String,
    val lastRefreshAt: Long?,
    val onboardingCompleted: Boolean,
)

class AppPreferences(private val context: Context) {
    val values: Flow<UserPreferences> = context.dataStore.data.map { prefs ->
        val accountName = prefs[Keys.ACCOUNT_NAME]
        val accountType = prefs[Keys.ACCOUNT_TYPE]
        UserPreferences(
            selectedAccount = if (accountName != null && accountType != null) ContactAccount(accountName, accountType) else null,
            accountConfirmed = prefs[Keys.ACCOUNT_CONFIRMED] ?: false,
            leapDayRule = runCatching { LeapDayRule.valueOf(prefs[Keys.LEAP_RULE] ?: "FEB_28") }.getOrDefault(LeapDayRule.FEB_28),
            widgetTheme = prefs[Keys.WIDGET_THEME] ?: "SYSTEM",
            widgetAlpha = (prefs[Keys.WIDGET_ALPHA] ?: 0.72f).coerceIn(0f, 1f),
            showAvatars = prefs[Keys.SHOW_AVATARS] ?: true,
            updateFrequency = prefs[Keys.UPDATE_FREQUENCY] ?: "WEEKLY",
            lastRefreshAt = prefs[Keys.LAST_REFRESH],
            onboardingCompleted = prefs[Keys.ONBOARDING] ?: false,
        )
    }

    suspend fun current(): UserPreferences = values.first()
    suspend fun setAccount(account: ContactAccount, confirmed: Boolean = true) = context.dataStore.edit {
        it[Keys.ACCOUNT_NAME] = account.name
        it[Keys.ACCOUNT_TYPE] = account.type
        it[Keys.ACCOUNT_CONFIRMED] = confirmed
    }
    suspend fun setOnboardingComplete() = context.dataStore.edit { it[Keys.ONBOARDING] = true }
    suspend fun setLastRefresh(value: Long) = context.dataStore.edit { it[Keys.LAST_REFRESH] = value }
    suspend fun setLeapRule(value: LeapDayRule) = context.dataStore.edit { it[Keys.LEAP_RULE] = value.name }
    suspend fun setWidgetTheme(value: String) = context.dataStore.edit { it[Keys.WIDGET_THEME] = value }
    suspend fun setWidgetAlpha(value: Float) = context.dataStore.edit { it[Keys.WIDGET_ALPHA] = value.coerceIn(0f, 1f) }
    suspend fun setShowAvatars(value: Boolean) = context.dataStore.edit { it[Keys.SHOW_AVATARS] = value }

    private object Keys {
        val ACCOUNT_NAME = stringPreferencesKey("selected_account_name")
        val ACCOUNT_TYPE = stringPreferencesKey("selected_account_type")
        val ACCOUNT_CONFIRMED = booleanPreferencesKey("selected_account_confirmed")
        val LEAP_RULE = stringPreferencesKey("leap_day_rule")
        val WIDGET_THEME = stringPreferencesKey("widget_theme")
        val WIDGET_ALPHA = floatPreferencesKey("widget_alpha")
        val SHOW_AVATARS = booleanPreferencesKey("widget_show_avatars")
        val UPDATE_FREQUENCY = stringPreferencesKey("update_check_frequency")
        val LAST_REFRESH = longPreferencesKey("last_contacts_refresh_at")
        val ONBOARDING = booleanPreferencesKey("onboarding_completed")
    }
}
