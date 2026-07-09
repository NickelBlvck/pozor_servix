<template>
  <section class="view active">
<!-- Секция валют -->
    <div class="settings-section">
      <h3>{{ t('settings.currency') }}</h3>
      <div class="setting-item">
        <label>{{ t('settings.default_currency') }}</label>
        <select v-model="settings.default_currency" @change="saveSetting('default_currency', settings.default_currency)">
          <option value="USDT">USDT</option>
          <option value="RUB">RUB</option>
        </select>
      </div>
      <div class="setting-item">
        <label>{{ t('settings.enable_rub') }}</label>
        <input type="checkbox" v-model="settings.enable_rub" @change="saveSetting('enable_rub', settings.enable_rub ? '1' : '0')" />
      </div>
      <div class="setting-item">
        <label>{{ t('settings.auto_update_rates') }}</label>
        <input type="checkbox" v-model="settings.auto_update_rates" @change="saveSetting('auto_update_rates', settings.auto_update_rates ? '1' : '0')" />
      </div>
      <button @click="updateCurrencyRates" class="btn btn-primary">
        {{ t('settings.update_rates_now') }}
      </button>
    </div>

    <!-- Секция авторов платежей -->
    <div class="settings-section">
      <h3>{{ t('settings.payment_authors') }}</h3>
      <div class="authors-list">
        <div v-for="author in authors" :key="author.id" class="author-item">
          <input 
            type="text" 
            v-model="author.name" 
            @blur="updateAuthor(author)"
            class="input"
          />
          <button @click="deleteAuthor(author.id)" class="btn btn-danger btn-sm">
            {{ t('common.delete') }}
          </button>
        </div>
      </div>
      <div class="add-author">
        <input 
          v-model="newAuthorName" 
          :placeholder="t('settings.new_author')"
          class="input"
          @keyup.enter="addAuthor"
        />
        <button @click="addAuthor" class="btn btn-success">
          {{ t('common.add') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../api'

const { t } = useI18n()
const settings = ref({
  default_currency: 'USDT',
  enable_rub: false,
  auto_update_rates: true
})
const authors = ref([])
const newAuthorName = ref('')

onMounted(async () => {
  await loadSettings()
  await loadAuthors()
})

async function loadSettings() {
  const res = await api.get('/api/settings')
  if (res.success) {
    settings.value = {
      default_currency: res.settings.find(s => s.key === 'default_currency')?.value || 'USDT',
      enable_rub: res.settings.find(s => s.key === 'enable_rub')?.value === '1',
      auto_update_rates: res.settings.find(s => s.key === 'auto_update_rates')?.value === '1'
    }
  }
}

async function loadAuthors() {
  const res = await api.get('/api/payment-authors')
  if (res.success) {
    authors.value = res.authors
  }
}

async function saveSetting(key, value) {
  await api.post(`/api/settings/${key}`, { value })
}

async function updateCurrencyRates() {
  const res = await api.get('/api/currency/rates')
  if (res.success) {
    alert(t('settings.rates_updated'))
  } else {
    alert(t('settings.rates_update_error'))
  }
}

async function addAuthor() {
  if (!newAuthorName.value.trim()) return
  const res = await api.post('/api/payment-authors', {
    name: newAuthorName.value,
    sort_order: authors.value.length + 1
  })
  if (res.success) {
    authors.value.push(res.author)
    newAuthorName.value = ''
  }
}

async function updateAuthor(author) {
  await api.put(`/api/payment-authors/${author.id}`, {
    name: author.name,
    sort_order: author.sort_order
  })
}

async function deleteAuthor(id) {
  if (!confirm(t('settings.confirm_delete_author'))) return
  const res = await api.delete(`/api/payment-authors/${id}`)
  if (res.success) {
    authors.value = authors.value.filter(a => a.id !== id)
  } else {
    alert(res.error)
  }
}
</script>
    <div class="section-head">
      <div>
        <h1>{{ app.t("nav.settings") }}</h1>
        <span>{{ app.t("settings.subtitle") }}</span>
      </div>
    </div>
    <div class="settings-stack">
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
        <label>{{ app.t("settings.leads") }}<input v-model="app.settings.notificationLeads" type="text" placeholder="5m, 2h, 1d, 3d, 5d" required></label>
        <div class="settings-inline-footer">
          <label class="check-row"><input v-model="app.settings.notifyOnStart" type="checkbox">{{ app.t("settings.notifyOnStart") }}</label>
          <button class="primary-button" type="submit"><SaveIcon :size="18" />{{ app.t("common.save") }}</button>
        </div>
        <p class="hint">{{ app.t("settings.leadsHint") }}</p>
      </form>

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

<script>
import { KeyRound as KeyRoundIcon, QrCode as QrCodeIcon, Save as SaveIcon, Send as SendIcon, Settings as SettingsIcon, ShieldCheck as ShieldCheckIcon } from "@lucide/vue";

export default {
  components: { KeyRoundIcon, QrCodeIcon, SaveIcon, SendIcon, SettingsIcon, ShieldCheckIcon },
  props: {
    app: { type: Object, required: true }
  }
};
</script>
