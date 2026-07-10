<template>
  <section class="view active">
    <div class="section-head">
      <div>
        <h1>{{ app.t("nav.settings") }}</h1>
        <span>{{ app.t("settings.subtitle") }}</span>
      </div>
    </div>
    <div class="settings-stack">
      <!-- Секция валют -->
      <div class="settings-panel">
        <div class="settings-card-head">
          <div class="settings-card-icon"><SettingsIcon :size="18" /></div>
          <div>
            <h2>{{ app.t('settings.currency') }}</h2>
            <span>{{ app.t('settings.currencySubtitle') }}</span>
          </div>
        </div>
        <div class="settings-form-grid">
          <label>
            {{ app.t('settings.default_currency') }}
            <select v-model="currencySettings.default_currency">
              <option value="USDT">USDT</option>
              <option value="RUB">RUB</option>
            </select>
          </label>
          <label class="check-row">
            <input type="checkbox" v-model="currencySettings.auto_update_rates" />
            {{ app.t('settings.auto_update_rates') }}
          </label>
        </div>
        <div class="settings-inline-footer">
          <button @click="updateCurrencyRates" class="primary-button" type="button">
            {{ app.t('settings.update_rates_now') }}
          </button>
          <button @click="saveCurrencySettings" class="primary-button" type="button">
            {{ app.t('common.save') }}
          </button>
        </div>
      </div>

      <!-- Секция авторов платежей -->
      <div class="settings-panel">
        <div class="settings-card-head">
          <div class="settings-card-icon"><SettingsIcon :size="18" /></div>
          <div>
            <h2>{{ app.t('settings.payment_authors') }}</h2>
            <span>{{ app.t('settings.payment_authors_subtitle') }}</span>
          </div>
        </div>
        <div class="authors-list">
          <div v-for="author in authors" :key="author.id" class="author-item">
            <input
              type="text"
              v-model="author.name"
              @blur="updateAuthor(author)"
              class="input"
              placeholder="Имя автора"
            />
            <button @click="deleteAuthor(author.id)" class="danger-button" type="button">
              {{ app.t('common.delete') }}
            </button>
          </div>
          <div v-if="authors.length === 0" class="hint">
            {{ app.t('settings.payment_authors') }} пока нет
          </div>
        </div>
        <div class="add-author">
          <input
            v-model="newAuthorName"
            :placeholder="app.t('settings.new_author')"
            class="input"
            @keyup.enter="addAuthor"
          />
          <button @click="addAuthor" class="primary-button" type="button">
            {{ app.t('settings.add_author') }}
          </button>
        </div>
      </div>

      <form class="settings-panel settings-panel-wide" @submit.prevent="app.saveSettings">
        <div class="settings-card-head">
          <div class="settings-card-icon"><SettingsIcon :size="18" /></div>
          <div>
            <h2>{{ app.t("settings.generalTitle") }}</h2>
            <span>{{ app.t("settings.generalText") }}</span>
          </div>
        </div>
        <label>{{ app.t("settings.siteTitle") }}<input v-model="app.settings.siteTitle" type="text" required></label>
        <div class="settings-form-grid">
          <label>{{ app.t("settings.language") }}<select v-model="app.settings.locale"><option v-for="locale in app.localeOptions" :key="locale" :value="locale">{{ app.t(`language.${locale}`) }}</option></select></label>
          <label>{{ app.t("settings.timezone") }}<input v-model="app.settings.timezone" type="text" placeholder="Europe/Moscow" required></label>
        </div>
        <label>{{ app.t("settings.telegramNotifyUrl") }}
          <span class="input-with-action">
            <input v-model="app.settings.telegramNotifyUrl" type="text" placeholder="tgram://token/chat_id:topic">
            <button class="input-action-button tooltip tooltip-left" type="button" :aria-label="app.t('settings.testTelegram')" :data-tooltip="app.t('settings.testTelegram')" @click="app.testTelegram(app.settings.telegramNotifyUrl)">
              <SendIcon :size="16" />
            </button>
          </span>
        </label>
        <label>{{ app.t("settings.plategaMerchantId") }}<input v-model="app.settings.plategaMerchantId" type="text" autocomplete="off" placeholder="your_platega_merchant_id"></label>
        <label>{{ app.t("settings.plategaSecret") }}<input v-model="app.settings.plategaSecret" type="password" autocomplete="new-password" placeholder="your_platega_secret"></label>
        <label>{{ app.t("settings.leads") }}<input v-model="app.settings.notificationLeads" type="text" placeholder="5m, 2h, 1d, 3d, 5d" required></label>
        <div class="settings-inline-footer">
          <label class="check-row"><input v-model="app.settings.notifyOnStart" type="checkbox">{{ app.t("settings.notifyOnStart") }}</label>
          <button class="primary-button" type="submit"><SaveIcon :size="18" />{{ app.t("common.save") }}</button>
        </div>
        <p class="hint">{{ app.t("settings.plategaHelp") }}</p>
        <p class="hint">{{ app.t("settings.leadsHint") }}</p>
      </form>

      <!-- Секция ежемесячных отчетов -->
      <div class="settings-panel">
        <div class="settings-card-head">
          <div class="settings-card-icon"><FileTextIcon :size="18" /></div>
          <div>
            <h2>{{ app.t('settings.statsReports') }}</h2>
            <span>{{ app.t('settings.statsReportsSubtitle') }}</span>
          </div>
        </div>
        <div class="settings-form-grid stats-report-settings">
          <label class="stats-report-url">{{ app.t('settings.statsNotifyUrl') }}
            <span class="input-with-action">
              <input v-model="statsSettings.statsTelegramNotifyUrl" type="text" placeholder="tgram://token/chat_id:topic">
              <button class="input-action-button tooltip tooltip-left" type="button" :aria-label="app.t('settings.testStatsReport')" :data-tooltip="app.t('settings.testStatsReport')" @click="testStatsReport">
                <SendIcon :size="16" />
              </button>
            </span>
          </label>
          <label class="check-row">
            <input type="checkbox" v-model="statsSettings.statsReportEnabled" />
            {{ app.t('settings.statsReportEnabled') }}
          </label>
          <label>
            {{ app.t('settings.statsReportDay') }}
            <input v-model="statsSettings.statsReportDay" type="number" min="1" max="28" required>
          </label>
          <label>
            {{ app.t('settings.statsReportPeriod') }}
            <select v-model="statsSettings.statsReportPeriod">
              <option value="prev_month">{{ app.t('settings.statsReportPeriodPrevMonth') }}</option>
              <option value="30d">{{ app.t('settings.statsReportPeriod30d') }}</option>
              <option value="90d">{{ app.t('settings.statsReportPeriod90d') }}</option>
            </select>
          </label>
        </div>
        <div class="settings-inline-footer">
          <button @click="saveStatsSettings" class="primary-button" type="button">
            {{ app.t('common.save') }}
          </button>
        </div>
      </div>

      <form class="settings-panel" @submit.prevent="app.changePassword">
        <div class="settings-card-head">
          <div class="settings-card-icon"><KeyRoundIcon :size="18" /></div>
          <div>
            <h2>{{ app.t("security.passwordTitle") }}</h2>
            <span>{{ app.t("security.passwordText") }}</span>
          </div>
        </div>
        <label>{{ app.t("security.currentPassword") }}<input v-model="app.passwordForm.currentPassword" type="password" autocomplete="current-password" required></label>
        <label>{{ app.t("security.newPassword") }}<input v-model="app.passwordForm.newPassword" type="password" autocomplete="new-password" required></label>
        <label>{{ app.t("security.repeatPassword") }}<input v-model="app.passwordForm.passwordRepeat" type="password" autocomplete="new-password" required></label>
        <button class="primary-button" type="submit"><SaveIcon :size="18" />{{ app.t("security.changePassword") }}</button>
      </form>

      <form class="settings-panel" @submit.prevent="app.submitTotp">
        <div class="settings-card-head">
          <div class="settings-card-icon"><ShieldCheckIcon :size="18" /></div>
          <div>
            <h2>{{ app.t("security.totpTitle") }}</h2>
            <span>{{ app.security.totpEnabled ? app.t("security.totpEnabledShort") : app.t("security.totpDisabledShort") }}</span>
          </div>
        </div>
        <p class="hint">{{ app.security.totpEnabled ? app.t("security.totpEnabled") : app.t("security.totpDisabled") }}</p>
        <label>{{ app.t("security.currentPassword") }}<input v-model="app.twoFactor.currentPassword" type="password" autocomplete="current-password" required></label>
        <template v-if="!app.security.totpEnabled && app.twoFactor.secret">
          <div class="totp-setup-grid">
            <div class="totp-qr-card">
              <img v-if="app.twoFactor.qrCode" :src="app.twoFactor.qrCode" :alt="app.t('security.qrCode')">
              <QrCodeIcon v-else :size="54" />
              <span>{{ app.t("security.qrCode") }}</span>
            </div>
            <div class="totp-secret-fields">
              <label>{{ app.t("security.totpSecret") }}<input :value="app.twoFactor.secret" type="text" readonly></label>
              <label>{{ app.t("security.totpUri") }}<textarea :value="app.twoFactor.otpauthUrl" rows="3" readonly></textarea></label>
            </div>
          </div>
          <label>{{ app.t("security.totpCode") }}<input v-model="app.twoFactor.token" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" required></label>
          <button class="primary-button" type="submit"><SaveIcon :size="18" />{{ app.t("security.enableTotp") }}</button>
        </template>
        <template v-else-if="app.security.totpEnabled">
          <label>{{ app.t("security.totpCode") }}<input v-model="app.twoFactor.token" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" required></label>
          <button class="danger-button" type="submit">{{ app.t("security.disableTotp") }}</button>
        </template>
        <button v-else class="primary-button" type="submit">{{ app.t("security.startTotp") }}</button>
      </form>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const props = defineProps({
  app: { type: Object, required: true }
})

const currencySettings = ref({
  default_currency: 'USDT',
  auto_update_rates: true
})

const authors = ref([])
const newAuthorName = ref('')

const statsSettings = ref({
  statsReportEnabled: false,
  statsReportDay: 1,
  statsReportPeriod: 'prev_month',
  statsTelegramNotifyUrl: ''
})

onMounted(async () => {
  await loadCurrencySettings()
  await loadAuthors()
  await loadStatsSettings()
})

async function loadCurrencySettings() {
  try {
    const data = await props.app.api('/api/assets')
    if (data && data.meta) {
      currencySettings.value = {
        default_currency: data.meta.default_currency || 'USDT',
        auto_update_rates: data.meta.auto_update_rates === true || data.meta.auto_update_rates === '1'
      }
    }
  } catch (error) {
    console.error('Failed to load currency settings:', error)
  }
}

async function loadAuthors() {
  try {
    const data = await props.app.api('/api/payment-authors')
    if (data && data.success) {
      authors.value = data.authors || []
    }
  } catch (error) {
    console.error('Failed to load authors:', error)
  }
}

async function loadStatsSettings() {
  try {
    const data = await props.app.api('/api/settings/stats_report')
    if (data && data.success) {
      statsSettings.value = {
        statsReportEnabled: data.statsReportEnabled || false,
        statsReportDay: data.statsReportDay || 1,
        statsReportPeriod: data.statsReportPeriod || 'prev_month',
        statsTelegramNotifyUrl: data.statsTelegramNotifyUrl || ''
      }
    }
  } catch (error) {
    console.error('Failed to load stats settings:', error)
  }
}

async function saveCurrencySettings() {
  try {
    await props.app.api('/api/settings/default_currency', {
      method: 'POST',
      body: JSON.stringify({ value: currencySettings.value.default_currency })
    })
    await props.app.api('/api/settings/auto_update_rates', {
      method: 'POST',
      body: JSON.stringify({ value: currencySettings.value.auto_update_rates ? '1' : '0' })
    })
    await props.app.load()
    props.app.toast(props.app.t('settings.saved'))
  } catch (error) {
    props.app.toast(error.message || props.app.t('settings.rates_update_error'))
  }
}

async function updateCurrencyRates() {
  try {
    const data = await props.app.api('/api/currency/rates')
    if (data && data.success) {
      props.app.toast(props.app.t('settings.rates_updated'))
    } else {
      props.app.toast(props.app.t('settings.rates_update_error'))
    }
  } catch (error) {
    props.app.toast(error.message || props.app.t('settings.rates_update_error'))
  }
}

async function addAuthor() {
  if (!newAuthorName.value.trim()) return
  try {
    const data = await props.app.api('/api/payment-authors', {
      method: 'POST',
      body: JSON.stringify({
        name: newAuthorName.value,
        sort_order: authors.value.length + 1
      })
    })
    if (data && data.success) {
      authors.value.push(data.author)
      props.app.authors = [...(props.app.authors || []), {
        id: data.author.id,
        name: data.author.name,
        sortOrder: data.author.sort_order,
        isActive: data.author.is_active !== 0
      }]
      newAuthorName.value = ''
      props.app.toast(props.app.t('settings.author_added'))
    }
  } catch (error) {
    props.app.toast(error.message)
  }
}

async function updateAuthor(author) {
  try {
    await props.app.api(`/api/payment-authors/${author.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: author.name,
        sort_order: author.sort_order
      })
    })
  } catch (error) {
    console.error('Failed to update author:', error)
  }
}

async function deleteAuthor(id) {
  if (!confirm(props.app.t('settings.confirm_delete_author'))) return
  try {
    const data = await props.app.api(`/api/payment-authors/${id}`, { method: 'DELETE' })
    if (data && data.success) {
      authors.value = authors.value.filter(a => a.id !== id)
      props.app.authors = (props.app.authors || []).filter(a => a.id !== id)
      props.app.toast(props.app.t('settings.author_deleted'))
    } else {
      props.app.toast(data?.error || props.app.t('settings.author_delete_error'))
    }
  } catch (error) {
    props.app.toast(error.message || props.app.t('settings.author_delete_error'))
  }
}

async function saveStatsSettings() {
  try {
    await props.app.api('/api/settings/stats_report', {
      method: 'POST',
      body: JSON.stringify({
        enabled: statsSettings.value.statsReportEnabled,
        day: statsSettings.value.statsReportDay,
        period: statsSettings.value.statsReportPeriod,
        url: statsSettings.value.statsTelegramNotifyUrl
      })
    })
    props.app.toast(props.app.t('settings.statsReportSaved'))
  } catch (error) {
    props.app.toast(error.message || props.app.t('settings.statsReportError'))
  }
}

async function testStatsReport() {
  try {
    const result = await props.app.api('/api/stats/report', {
      method: 'POST',
      body: JSON.stringify({
        url: statsSettings.value.statsTelegramNotifyUrl,
        period: statsSettings.value.statsReportPeriod,
        test: true
      })
    })
    if (result?.skipped) throw new Error(result.reason || props.app.t('settings.statsReportError'))
    props.app.toast(props.app.t('settings.statsReportTestSent'))
  } catch (error) {
    props.app.toast(error.message || props.app.t('settings.statsReportError'))
  }
}
</script>

<script>
import { KeyRound as KeyRoundIcon, QrCode as QrCodeIcon, Save as SaveIcon, Send as SendIcon, Settings as SettingsIcon, ShieldCheck as ShieldCheckIcon, FileText as FileTextIcon } from "@lucide/vue";

export default {
  components: { KeyRoundIcon, QrCodeIcon, SaveIcon, SendIcon, SettingsIcon, ShieldCheckIcon, FileTextIcon }
};
</script>

<style scoped>
.authors-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.author-item {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.author-item .input {
  flex: 1;
}

.add-author {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
}

.add-author .input {
  flex: 1;
}
</style>
