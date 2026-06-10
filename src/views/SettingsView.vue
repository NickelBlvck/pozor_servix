<template>
  <section class="view active">
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
