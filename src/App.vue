<template>
  <div class="orientation-lock">
    <div>
      <RotateCcwIcon :size="42" />
      <h1>{{ t("orientation.title") }}</h1>
      <p>{{ t("orientation.text") }}</p>
    </div>
  </div>

  <div v-if="!bootstrapped" class="boot-screen"></div>

  <TwoFactorView v-else-if="needsLogin && authRequiresTotp" :app="appContext" />
  <CreateView v-else-if="needsLogin && setupRequired" :app="appContext" />
  <LoginView v-else-if="needsLogin" :app="appContext" />

  <div v-else class="app-shell" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <button class="mobile-menu-button" type="button" :aria-label="t('nav.assets')" @click="mobileNavOpen = true"><MenuIcon :size="22" /><span>{{ meta.siteTitle }}</span></button>
    <div v-if="mobileNavOpen" class="sidebar-backdrop" @click="mobileNavOpen = false"></div>
    <aside class="sidebar" :class="{ open: mobileNavOpen }">
      <div class="brand">
        <div class="brand-mark">{{ t("logo.brand") }}</div>
        <div class="brand-text">
          <strong>{{ meta.siteTitle }}</strong>
          <span>{{ t("logo.subtitle") }}</span>
        </div>
        <button class="icon-button sidebar-collapse tooltip tooltip-right" type="button" :aria-label="sidebarCollapsed ? t('nav.expandMenu') : t('nav.collapseMenu')" :data-tooltip="sidebarCollapsed ? t('nav.expandMenu') : t('nav.collapseMenu')" @click="toggleSidebar">
          <PanelLeftOpenIcon v-if="sidebarCollapsed" :size="18" />
          <PanelLeftCloseIcon v-else :size="18" />
        </button>
        <button class="icon-button sidebar-close" type="button" :aria-label="t('common.cancel')" @click="mobileNavOpen = false"><XIcon :size="20" /></button>
      </div>

      <nav class="nav-tabs" :aria-label="t('nav.assets')">
        <button v-for="item in nav" :key="item.view" class="nav-button tooltip-collapsed" :class="{ active: view === item.view }" type="button" :aria-current="view === item.view ? 'page' : undefined" :data-tooltip="t(item.labelKey)" @click="go(item.view)">
          <span class="nav-icon"><component :is="item.icon" :size="18" /></span>
          <span class="nav-label">{{ t(item.labelKey) }}</span>
          <span v-if="item.view === 'alerts' && alerts.length" class="nav-badge">{{ alerts.length }}</span>
        </button>
      </nav>

      <div class="sidebar-bottom">
        <div class="summary">
          <div><span>{{ t("summary.servers") }}</span><strong>{{ countByType('vps') }}</strong></div>
          <div><span>{{ t("summary.domains") }}</span><strong>{{ countByType('domain') }}</strong></div>
          <div><span>{{ t("summary.providers") }}</span><strong>{{ providers.length }}</strong></div>
          <div class="summary-wide"><span>{{ t("summary.paid") }}</span><strong>{{ formatBoth(totalsAll) }}</strong></div>
          <div class="summary-wide"><span>{{ t("summary.terms") }}</span><strong>{{ alerts.length }}</strong></div>
        </div>
        <button class="secondary-button sidebar-logout tooltip-collapsed" type="button" :data-tooltip="t('common.logout')" @click="logout"><LogOutIcon :size="18" /><span>{{ t("common.logout") }}</span></button>
      </div>
    </aside>

    <main class="content">
      <AssetsView v-show="view === 'assets'" :app="appContext" />
      <ProvidersView v-show="view === 'providers'" :app="appContext" />
      <StatsView v-show="view === 'stats'" :app="appContext" />
      <AlertsView v-show="view === 'alerts'" :app="appContext" />
      <LogsView v-show="view === 'logs'" :app="appContext" />
      <GuideView v-show="view === 'guide'" :app="appContext" />
      <SettingsView v-show="view === 'settings'" :app="appContext" />
    </main>
  </div>

  <div v-if="modals.asset" class="modal-shell" @mousedown.self="closeModal('asset')">
    <div class="modal-card">
    <form id="assetForm" @submit.prevent="saveAsset">
      <div class="dialog-head">
        <h2>{{ editingAsset.id ? t("assets.edit") : t("assets.new") }}</h2>
        <button class="icon-button" type="button" @click="closeModal('asset')"><XIcon :size="20" /></button>
      </div>
      <div class="form-grid compact-grid">
        <fieldset class="type-toggle-group">
          <legend>{{ t("common.type") }}</legend>
          <label v-for="type in assetTypeOptions" :key="type" class="type-toggle" :class="{ active: editingAsset.type === type }">
            <input v-model="editingAsset.type" type="radio" :value="type">
            <span>{{ t(`type.${type}`) }}</span>
          </label>
        </fieldset>
        <label>{{ t("common.name") }}<input v-model="editingAsset.name" type="text" required></label>
        <label>{{ t("common.provider") }}<select v-model="editingAsset.providerId"><option value="">{{ t("common.providersEmpty") }}</option><option v-for="provider in providers" :key="provider.id" :value="provider.id">{{ provider.name }}</option></select></label>
        <template v-if="editingAsset.type === 'vps'">
          <label>IP<input v-model="editingAsset.ip" type="text"></label>
          <label>{{ t("common.country") }}
            <div class="search-select">
              <button class="search-select-button" type="button" @click="countrySelectOpen = !countrySelectOpen">
                <span><CountryFlag v-if="editingAsset.countryCode" :code="editingAsset.countryCode" /> {{ editingAsset.countryCode ? countryLabel(editingAsset.countryCode) : t("common.countryEmpty") }}</span>
              </button>
              <div v-if="countrySelectOpen" class="search-select-panel">
                <input v-model="countrySearch" type="search" :placeholder="t('common.searchCountry')" @keydown.escape="countrySelectOpen = false">
                <div class="search-select-options">
                  <button v-for="country in filteredCountries" :key="country.code || 'empty'" type="button" :class="{ active: editingAsset.countryCode === country.code }" @click="selectCountry(country.code)"><CountryFlag v-if="country.code" :code="country.code" /> {{ country.code ? countryLabel(country.code) : t("common.countryEmpty") }}</button>
                  <div v-if="!filteredCountries.length" class="inline-empty">{{ t("common.noCountries") }}</div>
                </div>
              </div>
            </div>
          </label>
        </template>
        <label v-else>{{ t("common.domain") }}<input v-model="editingAsset.domain" type="text"></label>
        <label>{{ t("common.expiresAt") }}<input v-model="editingAsset.expiresAt" class="datetime-input" type="datetime-local" step="60"></label>
      </div>
      <div class="dialog-actions" :class="{ 'has-danger': editingAsset.id }">
        <button class="danger-button icon-only tooltip" v-if="editingAsset.id" type="button" @click="deleteAsset" :aria-label="t('common.delete')" :data-tooltip="t('common.delete')"><Trash2Icon :size="18" /></button>
        <span></span>
        <button class="secondary-button" type="button" @click="closeModal('asset')">{{ t("common.cancel") }}</button>
        <button class="primary-button" type="submit"><SaveIcon :size="18" />{{ t("common.save") }}</button>
      </div>
    </form>
    </div>
  </div>

  <div v-if="modals.payments" class="modal-shell" @mousedown.self="closeModal('payments')">
    <div class="modal-card">
    <form id="paymentsForm" @submit.prevent>
      <div class="dialog-head"><h2>{{ t("payments.title", { name: paymentsAsset?.name || "" }) }}</h2><button class="icon-button" type="button" @click="closeModal('payments')"><XIcon :size="20" /></button></div>
      <div class="quick-payment">
        <label>{{ t("payments.amount") }}<input v-model.number="quickPayment.amount" type="number" min="0" step="0.000001" placeholder="0.00"></label>
        <label>{{ t("payments.currency") }}
          <select v-model="quickPayment.currency">
            <option value="USDT">USDT</option>
            <option value="RUB">RUB ₽</option>
          </select>
        </label>
        <label>{{ t("payments.author") }}
          <select v-model="quickPayment.authorId">
            <option value="">{{ t("payments.noAuthor") }}</option>
            <option v-for="author in authors" :key="author.id" :value="author.id">{{ author.name }}</option>
          </select>
        </label>
        <label>{{ t("common.dateTime") }}<input v-model="quickPayment.paidAt" class="datetime-input" type="datetime-local" step="60"></label>
        <button class="primary-button quick-add-button" type="button" :aria-label="t('common.addPayment')" @click="addQuickPayment"><PlusIcon :size="18" /></button>
      </div>
      <div class="payments-list">
        <article v-for="payment in paginatedAssetPayments" :key="payment.id" class="payment-item">
          <div>
            <strong>{{ paymentDisplay(payment) }}</strong>
            <span>{{ formatDateTime(payment.paidAt) }}<template v-if="payment.authorName"> · {{ payment.authorName }}</template><template v-if="payment.note"> · {{ payment.note }}</template></span>
          </div>
          <button class="icon-button" type="button" @click="deletePayment(payment.id)"><Trash2Icon :size="18" /></button>
        </article>
        <div v-if="!sortedPayments.length" class="inline-empty">{{ t("payments.empty") }}</div>
      </div>
      <div class="table-footer compact-footer" v-if="assetPaymentPages > 1">
        <span>{{ t("stats.shownOf", { shown: paginatedAssetPayments.length, total: tc("payment", sortedPayments.length) }) }}</span>
        <div class="pagination">
          <button class="secondary-button icon-only" type="button" @click="setAssetPaymentPage(assetPaymentPage - 1)" :disabled="assetPaymentPage <= 1" :aria-label="t('stats.prevPage')"><ChevronLeftIcon :size="16" /></button>
          <strong>{{ currentAssetPaymentPage }} / {{ assetPaymentPages }}</strong>
          <button class="secondary-button icon-only" type="button" @click="setAssetPaymentPage(assetPaymentPage + 1)" :disabled="assetPaymentPage >= assetPaymentPages" :aria-label="t('stats.nextPage')"><ChevronRightIcon :size="16" /></button>
        </div>
      </div>
    </form>
    </div>
  </div>

  <div v-if="modals.expire" class="modal-shell" @mousedown.self="closeModal('expire')">
    <div class="modal-card">
    <form id="expireForm" @submit.prevent>
      <div class="dialog-head"><h2>{{ t("common.term") }}: {{ expireAsset?.name }}</h2><button class="icon-button" type="button" @click="closeModal('expire')"><XIcon :size="20" /></button></div>
      <div class="expire-current">
        <span>{{ t("common.currentTerm") }}</span>
        <strong>{{ formatDateTime(expireAsset?.expiresAt) }}</strong>
      </div>
      <div class="date-adjust-panel">
        <div class="date-adjust-group is-minus">
          <div class="date-adjust-title"><strong>{{ t("duration.reduceTerm") }}</strong><span>{{ t("duration.reduceHint") }}</span></div>
          <div class="date-adjust-row">
            <button v-for="days in expirePresetDays" :key="'minus-' + days" class="secondary-button preset-button" type="button" @click="adjustExpireDays(-days)"><span>-</span>{{ tc("day", days) }}</button>
          </div>
        </div>
        <div class="date-adjust-group is-plus">
          <div class="date-adjust-title"><strong>{{ t("duration.extendTerm") }}</strong><span>{{ t("duration.extendHint") }}</span></div>
          <div class="date-adjust-row">
            <button v-for="days in expirePresetDays" :key="'plus-' + days" class="secondary-button preset-button" type="button" @click="adjustExpireDays(days)"><span>+</span>{{ tc("day", days) }}</button>
          </div>
        </div>
      </div>
    </form>
    </div>
  </div>

  <div v-if="modals.provider" class="modal-shell" @mousedown.self="closeModal('provider')">
    <div class="modal-card">
    <form id="providerForm" @submit.prevent="saveProvider">
      <div class="dialog-head"><h2>{{ editingProvider.id ? t("providers.edit") : t("providers.new") }}</h2><button class="icon-button" type="button" @click="closeModal('provider')"><XIcon :size="20" /></button></div>
      <div class="form-grid compact-grid">
        <label>{{ t("common.name") }}<input v-model="editingProvider.name" type="text" required></label>
        <label>{{ t("providers.loginUrl") }}<input v-model="editingProvider.loginUrl" type="url" placeholder="https://example.com/login"></label>
        <label>{{ t("providers.faviconUrl") }}<input v-model="editingProvider.faviconUrl" type="url" placeholder="https://example.com"></label>
        <label>{{ t("providers.color") }}
          <div class="color-input-row">
            <input v-model="editingProvider.color" type="text" placeholder="#38bdf8">
            <label class="color-swatch-button" :style="{ background: editingProvider.color }" :aria-label="t('providers.color')">
              <input v-model="editingProvider.color" type="color">
            </label>
          </div>
        </label>
        <label>{{ t("providers.note") }}<textarea ref="providerNote" v-model="editingProvider.note" class="autosize-textarea" rows="1" :placeholder="t('providers.notePlaceholder')" @input="autosizeTextarea"></textarea></label>
      </div>
      <div class="dialog-actions" :class="{ 'has-danger': editingProvider.id }">
        <button class="danger-button icon-only tooltip" v-if="editingProvider.id" type="button" @click="deleteProvider" :aria-label="t('common.delete')" :data-tooltip="t('common.delete')"><Trash2Icon :size="18" /></button>
        <span></span><button class="secondary-button" type="button" @click="closeModal('provider')">{{ t("common.cancel") }}</button><button class="primary-button" type="submit"><SaveIcon :size="18" />{{ t("common.save") }}</button>
      </div>
    </form>
    </div>
  </div>

  <div class="toast-host" aria-live="polite"><div v-for="toast in toasts" :key="toast.id" class="toast">{{ toast.message }}</div></div>
</template>

<script>
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import ruLocale from "../locale/ru.json";
import enLocale from "../locale/en.json";
import TwoFactorView from "./views/auth/2fa.vue";
import CreateView from "./views/auth/create.vue";
import LoginView from "./views/auth/login.vue";
import AlertsView from "./views/AlertsView.vue";
import AssetsView from "./views/AssetsView.vue";
import CountryFlag from "./components/CountryFlag.vue";
import GuideView from "./views/GuideView.vue";
import LogsView from "./views/LogsView.vue";
import ProvidersView from "./views/ProvidersView.vue";
import SettingsView from "./views/SettingsView.vue";
import StatsView from "./views/StatsView.vue";
import {
  BarChart3 as BarChartIcon,
  Bell as BellIcon,
  BookOpen as BookOpenIcon,
  Building2 as BuildingIcon,
  CalendarClock as CalendarClockIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  CreditCard as CreditCardIcon,
  Download as DownloadIcon,
  ExternalLink as ExternalLinkIcon,
  FileText as FileTextIcon,
  KeyRound as KeyRoundIcon,
  LogOut as LogOutIcon,
  Menu as MenuIcon,
  PanelLeftClose as PanelLeftCloseIcon,
  PanelLeftOpen as PanelLeftOpenIcon,
  Pencil as PencilIcon,
  Plus as PlusIcon,
  QrCode as QrCodeIcon,
  RotateCcw as RotateCcwIcon,
  Save as SaveIcon,
  ScrollText as ScrollTextIcon,
  Server as ServerIcon,
  Settings as SettingsIcon,
  ShieldCheck as ShieldCheckIcon,
  Trash2 as Trash2Icon,
  X as XIcon
} from "@lucide/vue";

const messages = { ru: ruLocale, en: enLocale };
const typeLabels = { vps: "type.vps", domain: "type.domain", certificate: "type.certificate" };
const localeOptions = ["ru", "en"];
const countryCodes = [
  "", "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ",
  "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS", "BT", "BV", "BW", "BY", "BZ",
  "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN", "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ",
  "DE", "DJ", "DK", "DM", "DO", "DZ",
  "EC", "EE", "EG", "EH", "ER", "ES", "ET",
  "FI", "FJ", "FK", "FM", "FO", "FR",
  "GA", "GB", "GD", "GE", "GF", "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY",
  "HK", "HM", "HN", "HR", "HT", "HU",
  "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT",
  "JE", "JM", "JO", "JP",
  "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ",
  "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY",
  "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK", "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ",
  "NA", "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ",
  "OM",
  "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY",
  "QA",
  "RE", "RO", "RS", "RU", "RW",
  "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS", "ST", "SV", "SX", "SY", "SZ",
  "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TW", "TZ",
  "UA", "UG", "UM", "US", "UY", "UZ",
  "VA", "VC", "VE", "VG", "VI", "VN", "VU",
  "WF", "WS",
  "YE", "YT",
  "ZA", "ZM", "ZW"
];
const countries = countryCodes.map((code) => ({ code, flag: countryFlag(code) }));
const navItems = [
  { view: "assets", labelKey: "nav.assets", icon: ServerIcon },
  { view: "providers", labelKey: "nav.providers", icon: BuildingIcon },
  { view: "stats", labelKey: "nav.stats", icon: BarChartIcon },
  { view: "alerts", labelKey: "nav.alerts", icon: BellIcon },
  { view: "logs", labelKey: "nav.logs", icon: ScrollTextIcon },
  { view: "guide", labelKey: "nav.guide", icon: BookOpenIcon },
  { view: "settings", labelKey: "nav.settings", icon: SettingsIcon }
];
export default {
  components: {
    AlertsView,
    AssetsView,
    BarChartIcon,
    BellIcon,
    BookOpenIcon,
    BuildingIcon,
    CalendarClockIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    CountryFlag,
    CreateView,
    CreditCardIcon,
    DownloadIcon,
    ExternalLinkIcon,
    FileTextIcon,
    GuideView,
    KeyRoundIcon,
    LoginView,
    LogOutIcon,
    LogsView,
    MenuIcon,
    PanelLeftCloseIcon,
    PanelLeftOpenIcon,
    PencilIcon,
    PlusIcon,
    ProvidersView,
    QrCodeIcon,
    RotateCcwIcon,
    SaveIcon,
    ScrollTextIcon,
    ServerIcon,
    SettingsView,
    SettingsIcon,
    ShieldCheckIcon,
    StatsView,
    Trash2Icon,
    TwoFactorView,
    XIcon
  },
  data() {
    return {
      nav: navItems,
      typeLabels,
      localeOptions,
      currentLocale: "ru",
      countries,
      assetTypeOptions: ["vps", "domain", "certificate"],
      expirePresetDays: [1, 3, 5, 10, 20, 30, 60, 90],
      bootstrapped: false,
      needsLogin: false,
      setupRequired: false,
      authRequiresTotp: false,
      auth: { login: "", password: "", passwordRepeat: "", token: "" },
      authError: "",
      otpDigits: ["", "", "", "", "", ""],
      otpInputRefs: [],
      view: "assets",
      mobileNavOpen: false,
      sidebarCollapsed: localStorage.getItem("sidebarCollapsed") === "true",
      statsPeriod: "90d",
      paymentTableSearch: "",
      paymentTableProvider: "all",
      paymentTableAuthor: "all",
      paymentTableSort: "date-desc",
      paymentTablePage: 1,
      paymentTablePageSize: 10,
      search: "",
      typeFilter: "all",
      draggedAssetId: "",
      countrySearch: "",
      countrySelectOpen: false,
      meta: { siteTitle: translate("ru", "app.defaultTitle"), notificationLeads: "5m,2h,1d,3d,5d", locale: "ru", timezone: "Europe/Moscow", telegramNotifyUrl: "", notifyOnStart: true, telegramConfigured: false },
      settings: { siteTitle: translate("ru", "app.defaultTitle"), notificationLeads: "5m,2h,1d,3d,5d", locale: "ru", timezone: "Europe/Moscow", telegramNotifyUrl: "", notifyOnStart: true },
      passwordForm: { currentPassword: "", newPassword: "", passwordRepeat: "" },
      security: { login: "", totpEnabled: false, hasPendingTotp: false },
      twoFactor: { currentPassword: "", token: "", secret: "", otpauthUrl: "", qrCode: "" },
      providers: [],
      assets: [],
      authors: [],
      rates: { USDT: null, USD: null, EUR: null },
      alerts: [],
      logs: [],
      logSearch: "",
      logActionFilter: "all",
      logSort: "date-desc",
      logPage: 1,
      logPageSize: 25,
      guideSearch: "",
      editingAsset: emptyAsset(),
      editingProvider: emptyProvider(),
      modals: { asset: false, payments: false, expire: false, provider: false },
      paymentsAssetId: "",
      assetPaymentPage: 1,
      assetPaymentPageSize: 5,
      expireAssetId: "",
      quickPayment: { amount: "", paidAt: toLocalInput(new Date()), currency: "USDT", authorId: "" },
      chartTooltip: null,
      toasts: []
    };
  },
  computed: {
    appContext() {
      return this;
    },
    vpsAssets() {
      return this.assets.filter((asset) => asset.type === "vps");
    },
    filteredAssets() {
      const query = this.search.trim().toLowerCase();
      return this.assets.filter((asset) => {
        const provider = this.providerOf(asset);
        const isInactive = Boolean(asset.inactive);
        const matchesType = this.typeFilter === "inactive"
          ? isInactive
          : !isInactive && (this.typeFilter === "all" || asset.type === this.typeFilter);
        const authorNames = (asset.payments || []).map((payment) => payment.authorName).filter(Boolean).join(" ");
        const haystack = [asset.name, asset.ip, asset.domain, provider?.name, authorNames].join(" ").toLowerCase();
        return matchesType && haystack.includes(query);
      });
    },
    guideSections() {
      return ["start", "records", "providers", "payments", "notifications", "statistics", "security", "logs", "bestPractices"]
        .map((id) => ({
          id,
          title: this.t(`guide.sections.${id}.title`),
          text: this.t(`guide.sections.${id}.text`),
          items: this.tList(`guide.sections.${id}.items`),
          do: this.tList(`guide.sections.${id}.do`),
          dont: this.tList(`guide.sections.${id}.dont`)
        }));
    },
    filteredGuideSections() {
      const query = this.guideSearch.trim().toLowerCase();
      if (!query) return this.guideSections;
      return this.guideSections.filter((section) => [
        section.title,
        section.text,
        ...section.items,
        ...section.do,
        ...section.dont
      ].join(" ").toLowerCase().includes(query));
    },
    assetGroups() {
      const groupTypes = this.typeFilter === "inactive" ? ["vps", "domain", "certificate"] : ["vps", "domain", "certificate"];
      return groupTypes
        .map((type) => ({
          type,
          label: this.typeLabel(type),
          items: this.filteredAssets.filter((asset) => asset.type === type).sort(compareAssetsOrder)
        }))
        .filter((group) => group.items.length);
    },
    totalPaid() {
      return this.assets.reduce((sum, asset) => sum + this.totalPayments(asset.payments), 0);
    },
    totalsAll() {
      return this.assets.reduce((acc, asset) => {
        const totals = this.totalsBoth(asset.payments);
        acc.usdt += totals.usdt;
        acc.rub += totals.rub;
        return acc;
      }, { usdt: 0, rub: 0 });
    },
    paymentsAsset() {
      return this.assetById(this.paymentsAssetId);
    },
    expireAsset() {
      return this.assetById(this.expireAssetId);
    },
    filteredCountries() {
      const query = this.countrySearch.trim().toLowerCase();
      return this.countries.filter((country) => {
        const label = country.code ? this.countryLabel(country.code) : this.t("common.countryEmpty");
        return [country.code, label].join(" ").toLowerCase().includes(query);
      });
    },
    sortedPayments() {
      return [...(this.paymentsAsset?.payments || [])].sort((a, b) => String(b.paidAt).localeCompare(String(a.paidAt)));
    },
    assetPaymentPages() {
      return Math.max(1, Math.ceil(this.sortedPayments.length / Number(this.assetPaymentPageSize || 5)));
    },
    currentAssetPaymentPage() {
      return Math.min(this.assetPaymentPage, this.assetPaymentPages);
    },
    paginatedAssetPayments() {
      const page = this.currentAssetPaymentPage;
      const size = Number(this.assetPaymentPageSize || 5);
      return this.sortedPayments.slice((page - 1) * size, page * size);
    },
    statCards() {
      const payments = this.periodPayments;
      const periodTotals = sumPaymentsBoth(payments);
      const overdue = this.vpsAssets.filter((asset) => this.minutesUntil(asset.expiresAt) < 0).length;
      const maxLeadMinutes = maxNotificationLeadMinutes(this.meta.notificationLeads);
      const soon = this.vpsAssets.filter((asset) => {
        const minutes = this.minutesUntil(asset.expiresAt);
        return minutes >= 0 && minutes <= maxLeadMinutes;
      }).length;
      const avgUsdt = payments.length ? periodTotals.usdt / payments.length : 0;
      const paidVps = new Set(payments.map((payment) => payment.asset?.id)).size;
      const maxPayment = payments.reduce((max, payment) => Math.max(max, Number(payment.usdt || 0)), 0);
      return [
        { label: this.t("stats.cardServers"), value: this.vpsAssets.length },
        { label: this.t("stats.cardPaidServers"), value: paidVps },
        { label: this.t("stats.cardPaidPeriodUsdt"), value: this.formatUsdt(periodTotals.usdt) },
        { label: this.t("stats.cardPaidPeriodRub"), value: this.formatRub(periodTotals.rub) },
        { label: this.t("stats.cardPayments"), value: payments.length },
        { label: this.t("stats.cardAvgPayment"), value: this.formatUsdt(avgUsdt) },
        { label: this.t("stats.cardMaxPayment"), value: this.formatUsdt(maxPayment) },
        { label: this.t("stats.cardSoon"), value: soon },
        { label: this.t("stats.cardOverdue"), value: overdue }
      ];
    },
    paymentTimeline() {
      return buildPaymentTimeline(this.periodPayments, this.statsPeriod, this.currentLocale, this.meta.timezone);
    },
    paymentAmountTimeline() {
      return this.paymentTimeline.filter((row) => row.amount > 0);
    },
    paymentCountTimeline() {
      return this.paymentTimeline.filter((row) => row.count > 0);
    },
    paymentAmountPoints() {
      return linePoints(this.paymentTimeline, "amount");
    },
    paymentAmountAreaPoints() {
      return areaPoints(this.paymentTimeline, "amount");
    },
    paymentAmountHits() {
      return chartHits(this.paymentTimeline, "amount");
    },
    paymentCountPoints() {
      return linePoints(this.paymentTimeline, "count");
    },
    paymentCountAreaPoints() {
      return areaPoints(this.paymentTimeline, "count");
    },
    paymentCountHits() {
      return chartHits(this.paymentTimeline, "count");
    },
    timelineAxisLabels() {
      const rows = this.paymentTimeline;
      if (!rows.length) return [];
      const indexes = [0, Math.floor((rows.length - 1) / 2), rows.length - 1];
      return [...new Set(indexes)].map((index) => rows[index]?.label).filter(Boolean);
    },
    timelineUnitLabel() {
      return this.statsPeriod === "7d" ? this.t("stats.unitHours") : this.t("stats.unitDays");
    },
    timelineTotal() {
      return this.paymentTimeline.reduce((sum, row) => sum + row.amount, 0);
    },
    typeSegments() {
      const rows = [
        { type: "ok", label: this.t("stats.segmentStable"), count: this.vpsAssets.filter((asset) => this.minutesUntil(asset.expiresAt) > 7 * 1440).length, className: "seg-0" },
        { type: "soon", label: this.t("stats.segmentSoon"), count: this.vpsAssets.filter((asset) => {
          const minutes = this.minutesUntil(asset.expiresAt);
          return minutes >= 0 && minutes <= 7 * 1440;
        }).length, className: "seg-1" },
        { type: "overdue", label: this.t("stats.segmentOverdue"), count: this.vpsAssets.filter((asset) => this.minutesUntil(asset.expiresAt) < 0).length, className: "seg-2" }
      ];
      const total = Math.max(1, rows.reduce((sum, item) => sum + item.count, 0));
      let offset = 0;
      return rows.map((item) => {
        const dash = (item.count / total) * 100;
        const row = { ...item, dash, offset };
        offset += dash;
        return row;
      });
    },
    providerSpend() {
      const rows = this.providers.map((provider) => {
        const value = this.periodPayments
          .filter((payment) => payment.asset?.providerId === provider.id)
          .reduce((sum, payment) => sum + Number(payment.usdt || 0), 0);
        return { id: provider.id, name: provider.name, color: provider.color || providerFallbackColor(provider.id), value };
      }).filter((row) => row.value > 0).sort((a, b) => b.value - a.value).slice(0, 8);
      const max = Math.max(1, ...rows.map((row) => row.value));
      return rows.map((row) => ({ ...row, width: (row.value / max) * 100 }));
    },
    paymentTableProviders() {
      const ids = new Set(this.periodPayments.map((payment) => payment.asset?.providerId).filter(Boolean));
      return this.providers.filter((provider) => ids.has(provider.id));
    },
    paymentTableAuthors() {
      const ids = new Set(this.periodPayments.map((payment) => payment.authorId).filter(Boolean));
      return this.authors.filter((author) => ids.has(author.id));
    },
    filteredPeriodPayments() {
      const query = this.paymentTableSearch.trim().toLowerCase();
      return this.periodPayments.filter((payment) => {
        const provider = this.providerOf(payment.asset);
        const providerId = payment.asset?.providerId || "";
        const matchesProvider = this.paymentTableProvider === "all"
          || (this.paymentTableProvider === "none" && !providerId)
          || providerId === this.paymentTableProvider;
        const authorId = payment.authorId || "";
        const matchesAuthor = this.paymentTableAuthor === "all"
          || (this.paymentTableAuthor === "none" && !authorId)
          || authorId === this.paymentTableAuthor;
        const haystack = [
          payment.asset?.name,
          provider?.name,
          payment.amount,
          payment.authorName,
          this.formatDateTime(payment.paidAt)
        ].join(" ").toLowerCase();
        return matchesProvider && matchesAuthor && haystack.includes(query);
      });
    },
    filteredPeriodPaymentsTotal() {
      return this.formatBoth(sumPaymentsBoth(this.filteredPeriodPayments));
    },
    periodPaymentsSorted() {
      const rows = [...this.filteredPeriodPayments];
      const sorters = {
        "date-desc": (a, b) => String(b.paidAt).localeCompare(String(a.paidAt)),
        "date-asc": (a, b) => String(a.paidAt).localeCompare(String(b.paidAt)),
        "amount-desc": (a, b) => Number(b.usdt || 0) - Number(a.usdt || 0),
        "amount-asc": (a, b) => Number(a.usdt || 0) - Number(b.usdt || 0),
        "server-asc": (a, b) => String(a.asset?.name || "").localeCompare(String(b.asset?.name || ""), "ru"),
        "provider-asc": (a, b) => String(this.providerOf(a.asset)?.name || "").localeCompare(String(this.providerOf(b.asset)?.name || ""), "ru")
      };
      return rows.sort(sorters[this.paymentTableSort] || sorters["date-desc"]);
    },
    paymentTablePages() {
      return Math.max(1, Math.ceil(this.periodPaymentsSorted.length / Number(this.paymentTablePageSize || 10)));
    },
    paginatedPeriodPayments() {
      const page = Math.min(this.paymentTablePage, this.paymentTablePages);
      const size = Number(this.paymentTablePageSize || 10);
      return this.periodPaymentsSorted.slice((page - 1) * size, page * size);
    },
    periodPayments() {
      const since = periodStart(this.statsPeriod);
      return this.vpsAssets.flatMap((asset) => (asset.payments || []).map((payment) => ({ ...payment, asset })))
        .filter((payment) => {
          if (!since) return true;
          const paidAt = parseAppDate(payment.paidAt);
          return !Number.isNaN(paidAt.getTime()) && paidAt >= since;
        });
    },
    telegramStatus() {
      return this.meta.telegramConfigured
        ? this.t("alerts.configured")
        : this.t("alerts.notConfigured");
    },
    logActions() {
      return [...new Set(this.logs.map((item) => item.action).filter(Boolean))].sort();
    },
    filteredLogs() {
      const query = this.logSearch.trim().toLowerCase();
      return this.logs.filter((item) => {
        const matchesAction = this.logActionFilter === "all" || item.action === this.logActionFilter;
        const haystack = [item.at, item.action, item.method, item.path, item.ip, this.logDetails(item)].join(" ").toLowerCase();
        return matchesAction && haystack.includes(query);
      }).sort((a, b) => this.logSort === "date-asc"
        ? String(a.at).localeCompare(String(b.at))
        : String(b.at).localeCompare(String(a.at)));
    },
    logPages() {
      return Math.max(1, Math.ceil(this.filteredLogs.length / Number(this.logPageSize || 25)));
    },
    currentLogPage() {
      return Math.min(this.logPage, this.logPages);
    },
    paginatedLogs() {
      const page = this.currentLogPage;
      const size = Number(this.logPageSize || 25);
      return this.filteredLogs.slice((page - 1) * size, page * size);
    }
  },
  watch: {
    statsPeriod: "resetPaymentTablePage",
    paymentTableSearch: "resetPaymentTablePage",
    paymentTableProvider: "resetPaymentTablePage",
    paymentTableAuthor: "resetPaymentTablePage",
    paymentTableSort: "resetPaymentTablePage",
    paymentTablePageSize: "resetPaymentTablePage",
    logSearch: "resetLogPage",
    logActionFilter: "resetLogPage",
    logSort: "resetLogPage",
    logPageSize: "resetLogPage"
  },
  async mounted() {
    this.view = viewFromPath(location.pathname);
    window.addEventListener("popstate", () => {
      this.view = viewFromPath(location.pathname);
    });
    try {
      const auth = await this.api("/api/auth/status");
      if (auth.meta) {
        this.meta = { ...this.meta, ...auth.meta };
        this.currentLocale = messages[auth.meta.locale] ? auth.meta.locale : "ru";
        document.title = this.meta.siteTitle;
      }
      this.setupRequired = Boolean(auth.setupRequired);
      this.needsLogin = auth.setupRequired || !auth.authenticated;
      if (!this.needsLogin) {
        await this.load();
        await this.loadSecurity();
        if (this.view === "logs") await this.loadLogs();
      }
    } catch {
      this.needsLogin = true;
    } finally {
      this.bootstrapped = true;
    }
  },
  methods: {
    t(key, params = {}) {
      return translate(this.currentLocale, key, params);
    },
    tList(key) {
      return translateList(this.currentLocale, key);
    },
    tc(key, count, params = {}) {
      return translatePlural(this.currentLocale, key, count, params);
    },
    typeLabel(type) {
      return this.t(`type.${type}`) || this.t("type.record");
    },
    async api(path, options = {}) {
      const response = await fetch(path, { headers: { "content-type": "application/json" }, ...options });
      const text = await response.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { error: this.t("toast.requestError") };
      }
      if (!response.ok) throw new Error(data.error || this.t("toast.requestError"));
      return data;
    },
    async submitAuth() {
      try {
        const path = this.setupRequired ? "/api/auth/setup" : "/api/auth/login";
        const payload = { ...this.auth, token: this.authRequiresTotp ? this.otpDigits.join("") : this.auth.token };
        const result = await this.api(path, { method: "POST", body: JSON.stringify(payload) });
        if (result.requiresTotp) {
          this.authRequiresTotp = true;
          this.authError = "";
          this.auth.token = "";
          this.otpDigits = ["", "", "", "", "", ""];
          this.$nextTick(() => this.focusOtp(0));
          return;
        }
        this.needsLogin = false;
        this.authRequiresTotp = false;
        this.authError = "";
        this.toast(this.t("toast.login"));
        await this.load();
        await this.loadSecurity();
      } catch (error) {
        this.authError = this.authRequiresTotp ? this.t("security.invalidTotp") : this.t("auth.invalidLogin");
      }
    },
    setOtpInputRef(element, index) {
      if (element) this.otpInputRefs[index] = element;
    },
    focusOtp(index) {
      this.otpInputRefs[Math.max(0, Math.min(5, index))]?.focus();
    },
    handleOtpInput(index, event) {
      const value = String(event.target.value || "").replace(/\D/g, "");
      if (value.length > 1) return this.fillOtp(value, index);
      this.otpDigits[index] = value;
      this.authError = "";
      if (value && index < 5) this.focusOtp(index + 1);
      if (this.otpDigits.every(Boolean)) this.submitAuth();
    },
    handleOtpKeydown(index, event) {
      if (event.key === "Backspace" && !this.otpDigits[index] && index > 0) {
        this.otpDigits[index - 1] = "";
        this.$nextTick(() => this.focusOtp(index - 1));
      }
      if (event.key === "ArrowLeft" && index > 0) this.focusOtp(index - 1);
      if (event.key === "ArrowRight" && index < 5) this.focusOtp(index + 1);
    },
    handleOtpPaste(index, event) {
      event.preventDefault();
      const value = event.clipboardData?.getData("text") || "";
      const digits = String(value || "").replace(/\D/g, "");
      this.fillOtp(digits, digits.length >= 6 ? 0 : index);
    },
    fillOtp(value, startIndex = 0) {
      const digits = String(value || "").replace(/\D/g, "").slice(0, 6 - startIndex).split("");
      digits.forEach((digit, offset) => {
        this.otpDigits[startIndex + offset] = digit;
      });
      this.authError = "";
      const next = Math.min(5, startIndex + digits.length);
      this.$nextTick(() => this.focusOtp(next));
      if (this.otpDigits.every(Boolean)) this.submitAuth();
    },
    resetTotpLogin() {
      this.authRequiresTotp = false;
      this.authError = "";
      this.auth.token = "";
      this.auth.password = "";
      this.otpDigits = ["", "", "", "", "", ""];
    },
    async logout() {
      await this.api("/api/auth/logout", { method: "POST" });
      location.reload();
    },
    async load() {
      const data = await this.api("/api/assets");
      this.meta = data.meta;
      this.currentLocale = messages[data.meta.locale] ? data.meta.locale : "ru";
      this.settings = {
        siteTitle: data.meta.siteTitle,
        notificationLeads: data.meta.notificationLeads || "5m,2h,1d,3d,5d",
        locale: this.currentLocale,
        timezone: data.meta.timezone || "Europe/Moscow",
        telegramNotifyUrl: data.meta.telegramNotifyUrl || "",
        notifyOnStart: Boolean(data.meta.notifyOnStart)
      };
      this.providers = data.providers || [];
      this.assets = data.assets || [];
      this.authors = data.authors || [];
      this.rates = data.rates || { USDT: null, USD: null, EUR: null };
      if (!this.quickPayment.currency || (this.quickPayment.currency === "USDT" && data.meta?.default_currency === "RUB")) {
        this.quickPayment.currency = data.meta?.default_currency || "USDT";
      }
      this.alerts = (await this.api("/api/notifications")).items || [];
      document.title = this.meta.siteTitle;
    },
    async loadSecurity() {
      this.security = await this.api("/api/auth/security");
    },
    go(view) {
      this.view = view;
      this.mobileNavOpen = false;
      const path = pathFromView(view);
      if (location.pathname !== path) history.pushState({}, "", path);
      if (view === "logs") this.loadLogs();
    },
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed;
      localStorage.setItem("sidebarCollapsed", String(this.sidebarCollapsed));
    },
    openModal(name) {
      this.modals[name] = true;
    },
    closeModal(name) {
      this.modals[name] = false;
    },
    openAsset(asset = null) {
      this.editingAsset = asset ? clone(asset) : emptyAsset();
      this.countrySearch = "";
      this.countrySelectOpen = false;
      this.openModal("asset");
    },
    async saveAsset() {
      const asset = { ...this.editingAsset };
      if (asset.type === "vps") asset.domain = "";
      else {
        asset.ip = "";
        asset.countryCode = "";
      }
      const path = asset.id ? `/api/assets/${asset.id}` : "/api/assets";
      const method = asset.id ? "PUT" : "POST";
      await this.api(path, { method, body: JSON.stringify(asset) });
      this.closeModal("asset");
      this.toast(this.t("assets.saved"));
      await this.load();
    },
    async toggleAssetInactive(asset, inactive = true) {
      await this.updateAsset({ ...asset, inactive });
      this.toast(inactive ? this.t("assets.deactivated") : this.t("assets.activated"));
      await this.load();
    },
    async deleteAsset() {
      if (!confirm(this.t("assets.deleteConfirm", { name: this.editingAsset.name }))) return;
      await this.api(`/api/assets/${this.editingAsset.id}`, { method: "DELETE" });
      this.closeModal("asset");
      this.toast(this.t("assets.deleted"));
      await this.load();
    },
    async copyIp(ip) {
      const value = String(ip || "").trim();
      if (!value) return;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(value);
        } else {
          fallbackCopyText(value);
        }
        this.toast(this.t("assets.ipCopied"));
      } catch {
        try {
          fallbackCopyText(value);
          this.toast(this.t("assets.ipCopied"));
        } catch {
          this.toast(this.t("assets.copyFailed"));
        }
      }
    },
    openProvider(provider = null) {
      this.editingProvider = provider ? clone(provider) : emptyProvider();
      this.openModal("provider");
      this.$nextTick(() => this.autosizeTextarea({ target: this.$refs.providerNote }));
    },
    async saveProvider() {
      const path = this.editingProvider.id ? `/api/providers/${this.editingProvider.id}` : "/api/providers";
      const method = this.editingProvider.id ? "PUT" : "POST";
      await this.api(path, { method, body: JSON.stringify(this.editingProvider) });
      this.closeModal("provider");
      this.toast(this.t("providers.saved"));
      await this.load();
    },
    async deleteProvider() {
      if (!confirm(this.t("providers.deleteConfirm", { name: this.editingProvider.name }))) return;
      await this.api(`/api/providers/${this.editingProvider.id}`, { method: "DELETE" });
      this.closeModal("provider");
      this.toast(this.t("providers.deleted"));
      await this.load();
    },
    openPayments(asset) {
      this.paymentsAssetId = asset.id;
      this.assetPaymentPage = 1;
      this.quickPayment = { amount: "", paidAt: toLocalInput(new Date()), currency: this.meta?.default_currency || "USDT", authorId: "" };
      this.openModal("payments");
    },
    async addQuickPayment() {
      const asset = this.assetById(this.paymentsAssetId);
      const amount = Number(this.quickPayment.amount || 0);
      if (!asset || amount <= 0) return this.toast(this.t("payments.addAmount"));
      await this.updateAsset({ ...asset, payments: [...(asset.payments || []), { amount, paidAt: this.quickPayment.paidAt || toLocalInput(new Date()), note: "", currency: this.quickPayment.currency, authorId: this.quickPayment.authorId }] });
      this.toast(this.t("payments.added"));
      await this.load();
      this.quickPayment = { amount: "", paidAt: toLocalInput(new Date()), currency: this.quickPayment.currency, authorId: this.quickPayment.authorId };
    },
    async deletePayment(paymentId) {
      const asset = this.assetById(this.paymentsAssetId);
      if (!asset) return;
      await this.updateAsset({ ...asset, payments: (asset.payments || []).filter((payment) => payment.id !== paymentId) });
      this.toast(this.t("payments.deleted"));
      await this.load();
    },
    openExpire(asset) {
      this.expireAssetId = asset.id;
      this.openModal("expire");
    },
    async adjustExpireDays(days) {
      const asset = this.assetById(this.expireAssetId);
      if (!asset) return;
      const current = parseAppDate(asset.expiresAt);
      const date = Number.isNaN(current.getTime()) ? new Date() : current;
      date.setDate(date.getDate() + days);
      await this.updateAsset({ ...asset, expiresAt: toLocalInput(date) });
      this.toast(this.t("settings.saved"));
      await this.load();
    },
    async updateAsset(asset) {
      return this.api(`/api/assets/${asset.id}`, { method: "PUT", body: JSON.stringify(asset) });
    },
    startAssetDrag(asset, event) {
      this.draggedAssetId = asset.id;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", asset.id);
    },
    endAssetDrag() {
      this.draggedAssetId = "";
    },
    async dropAsset(targetAsset) {
      const dragged = this.assetById(this.draggedAssetId);
      this.draggedAssetId = "";
      if (!dragged || !targetAsset || dragged.id === targetAsset.id || dragged.type !== targetAsset.type || Boolean(dragged.inactive) !== Boolean(targetAsset.inactive)) return;
      const sameType = this.assets.filter((asset) => asset.type === dragged.type && Boolean(asset.inactive) === Boolean(dragged.inactive)).sort(compareAssetsOrder);
      const nextOrder = sameType.filter((asset) => asset.id !== dragged.id);
      const targetIndex = nextOrder.findIndex((asset) => asset.id === targetAsset.id);
      nextOrder.splice(Math.max(0, targetIndex), 0, dragged);
      const orderedIds = nextOrder.map((asset) => asset.id);
      this.assets = this.assets.map((asset) => {
        const index = orderedIds.indexOf(asset.id);
        return index >= 0 ? { ...asset, sortOrder: index } : asset;
      });
      try {
        await this.api("/api/assets/reorder", { method: "POST", body: JSON.stringify({ type: dragged.type, inactive: Boolean(dragged.inactive), ids: orderedIds }) });
        await this.load();
      } catch (error) {
        this.toast(error.message);
        await this.load();
      }
    },
    async saveSettings() {
      this.meta = await this.api("/api/settings", { method: "PUT", body: JSON.stringify(this.settings) });
      this.currentLocale = messages[this.settings.locale] ? this.settings.locale : "ru";
      this.toast(this.t("settings.saved"));
      await this.load();
    },
    async changePassword() {
      await this.api("/api/auth/password", { method: "POST", body: JSON.stringify(this.passwordForm) });
      this.passwordForm = { currentPassword: "", newPassword: "", passwordRepeat: "" };
      this.toast(this.t("security.passwordChanged"));
    },
    async startTotpSetup() {
      const result = await this.api("/api/auth/2fa/setup", { method: "POST", body: JSON.stringify({ currentPassword: this.twoFactor.currentPassword }) });
      const qrCode = await QRCode.toDataURL(result.otpauthUrl, { margin: 1, width: 220, color: { dark: "#071110", light: "#ffffff" } });
      this.twoFactor.secret = result.secret;
      this.twoFactor.otpauthUrl = result.otpauthUrl;
      this.twoFactor.qrCode = qrCode;
      this.twoFactor.token = "";
      this.toast(this.t("security.totpStarted"));
    },
    async submitTotp() {
      if (this.security.totpEnabled) return this.disableTotp();
      if (this.twoFactor.secret) return this.enableTotp();
      return this.startTotpSetup();
    },
    async enableTotp() {
      await this.api("/api/auth/2fa/enable", { method: "POST", body: JSON.stringify({ currentPassword: this.twoFactor.currentPassword, token: this.twoFactor.token }) });
      this.twoFactor = { currentPassword: "", token: "", secret: "", otpauthUrl: "", qrCode: "" };
      await this.loadSecurity();
      this.toast(this.t("security.totpEnabledToast"));
    },
    async disableTotp() {
      await this.api("/api/auth/2fa/disable", { method: "POST", body: JSON.stringify({ currentPassword: this.twoFactor.currentPassword, token: this.twoFactor.token }) });
      this.twoFactor = { currentPassword: "", token: "", secret: "", otpauthUrl: "", qrCode: "" };
      await this.loadSecurity();
      this.toast(this.t("security.totpDisabledToast"));
    },
    async testTelegram(telegramNotifyUrl = this.settings.telegramNotifyUrl) {
      const result = await this.api("/api/telegram/test", { method: "POST", body: JSON.stringify({ telegramNotifyUrl }) });
      this.toast(result.skipped ? this.t("alerts.testSkipped") : this.t("alerts.testSent"));
    },
    async loadLogs() {
      const data = await this.api("/api/logs");
      this.logs = data.items || [];
    },
    logDetails(item) {
      return item.details ? JSON.stringify(item.details) : "";
    },
    lastPaymentAuthor(asset) {
      const payments = [...(asset.payments || [])].sort((a, b) => String(b.paidAt).localeCompare(String(a.paidAt)));
      return payments.find((payment) => payment.authorName)?.authorName || "";
    },
    providerOf(asset) {
      return this.providers.find((provider) => provider.id === asset.providerId);
    },
    providerStyle(provider) {
      const color = provider?.color || providerFallbackColor(provider?.id || provider?.name || "default");
      return { "--provider-color": color };
    },
    providerInitial(asset) {
      return (this.providerOf(asset)?.name || "?").slice(0, 1).toUpperCase();
    },
    domainHref(domain) {
      const value = String(domain || "").trim();
      if (!value) return "#";
      return /^https?:\/\//i.test(value) ? value : `https://${value}`;
    },
    assetSubtitle(asset) {
      if (asset.type === "vps") return asset.countryCode ? countryLabelForLocale(asset.countryCode, this.currentLocale) : this.t("common.countryEmpty");
      return asset.domain || this.t("common.domain");
    },
    countryLabel(code) {
      return countryLabelForLocale(code, this.currentLocale);
    },
    selectCountry(code) {
      this.editingAsset.countryCode = code;
      this.countrySearch = "";
      this.countrySelectOpen = false;
    },
    assetById(id) {
      return this.assets.find((asset) => asset.id === id);
    },
    resetPaymentTablePage() {
      this.paymentTablePage = 1;
    },
    setPaymentPage(page) {
      this.paymentTablePage = Math.min(this.paymentTablePages, Math.max(1, Number(page || 1)));
    },
    setAssetPaymentPage(page) {
      this.assetPaymentPage = Math.min(this.assetPaymentPages, Math.max(1, Number(page || 1)));
    },
    resetLogPage() {
      this.logPage = 1;
    },
    setLogPage(page) {
      this.logPage = Math.min(this.logPages, Math.max(1, Number(page || 1)));
    },
    paymentExportRows() {
      return this.periodPaymentsSorted.map((payment) => ({
        date: this.formatDateTime(payment.paidAt),
        server: payment.asset?.name || "",
        provider: this.providerOf(payment.asset)?.name || this.t("common.providerEmpty"),
        author: payment.authorName || "",
        currency: String(payment.currency || "USDT").toUpperCase(),
        amount: Number(payment.amount || 0),
        usdt: Number(payment.usdt || 0),
        rub: Number(payment.rub || 0)
      }));
    },
    exportPaymentsCsv() {
      const rows = this.paymentExportRows();
      if (!rows.length) return;
      const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
      const csv = [
        [this.t("export.date"), this.t("export.server"), this.t("export.provider"), this.t("payments.author"), this.t("payments.currency"), this.t("export.amount"), "USDT", "RUB"].map(escape).join(","),
        ...rows.map((row) => [row.date, row.server, row.provider, row.author, row.currency, row.amount, row.usdt, row.rub].map(escape).join(","))
      ].join("\n");
      const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `payments-${this.statsPeriod}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    },
    async exportPaymentsPdf() {
      const rows = this.paymentExportRows();
      if (!rows.length) return;
      const doc = new jsPDF({ orientation: "landscape" });
      const headers = [this.t("export.date"), this.t("export.server"), this.t("export.provider"), this.t("payments.author"), this.t("payments.currency"), this.t("export.amount"), "USDT", "RUB"];
      const body = rows.map((row) => [
        row.date, row.server, row.provider, row.author, row.currency,
        row.amount.toFixed(2).replace(/\.?0+$/, ""),
        row.usdt.toFixed(6).replace(/\.?0+$/, ""),
        row.rub.toFixed(2).replace(/\.?0+$/, "")
      ]);
      const pages = buildPdfCanvases(this.t("export.title"), headers, body);
      pages.forEach((canvas, index) => {
        if (index > 0) doc.addPage("a4", "landscape");
        doc.addImage(canvas.toDataURL("image/png"), "PNG", 8, 8, 281, 194);
      });
      doc.save(`payments-${this.statsPeriod}.pdf`);
    },
    countByType(type) {
      return this.assets.filter((asset) => asset.type === type).length;
    },
    totalPayments(payments = []) {
      return payments.reduce((sum, payment) => sum + Number(payment.usdt || payment.amount || 0), 0);
    },
    totalsBoth(payments = []) {
      return sumPaymentsBoth(payments);
    },
    formatUsdt(value) {
      return `${new Intl.NumberFormat(this.currentLocale === "en" ? "en-US" : "ru-RU", { maximumFractionDigits: 6 }).format(Number(value || 0))} USDT`;
    },
    formatRub(value) {
      return `${new Intl.NumberFormat(this.currentLocale === "en" ? "en-US" : "ru-RU", { maximumFractionDigits: 2 }).format(Number(value || 0))} ₽`;
    },
    formatBoth(totals) {
      if (!totals) return this.formatUsdt(0);
      const rub = Number(totals.rub || 0);
      const usdt = Number(totals.usdt || 0);
      return rub > 0 ? `${this.formatUsdt(usdt)} · ${this.formatRub(rub)}` : this.formatUsdt(usdt);
    },
    paymentDisplay(payment) {
      const amount = Number(payment.amount || 0);
      const currency = String(payment.currency || "USDT").toUpperCase();
      const primary = currency === "RUB" ? this.formatRub(amount) : this.formatUsdt(amount);
      const usdt = Number(payment.usdt || 0);
      const rub = Number(payment.rub || 0);
      const secondary = currency === "RUB" ? `≈ ${this.formatUsdt(usdt)}` : (rub > 0 ? `≈ ${this.formatRub(rub)}` : "");
      return secondary ? `${primary} (${secondary})` : primary;
    },
    formatShort(value) {
      return new Intl.NumberFormat(this.currentLocale === "en" ? "en-US" : "ru-RU", { maximumFractionDigits: 2 }).format(Number(value || 0));
    },
    dueStateClass(value) {
      const diff = this.minutesUntil(value);
      if (diff < 0) return "is-overdue";
      if (diff <= 7 * 1440) return "is-soon";
      return "";
    },
    minutesUntil(value) {
      const date = parseAppDate(value);
      return Math.ceil((date - new Date()) / 60_000);
    },
    daysText(value) {
      const minutes = this.minutesUntil(value);
      if (minutes < 0) return this.t("duration.overdue", { duration: this.formatDuration(Math.abs(minutes)) });
      if (minutes === 0) return this.t("duration.expiresNow");
      return this.t("duration.expiresIn", { duration: this.formatDuration(minutes) });
    },
    alertWhen(item) {
      if (item.minutesLeft < 0) return this.t("duration.overdueLower", { duration: this.formatDuration(Math.abs(item.minutesLeft)) });
      if (item.minutesLeft === 0) return this.t("common.now");
      return this.t("duration.in", { duration: this.formatDuration(item.minutesLeft) });
    },
    formatDateTime(value) {
      const date = parseAppDate(value);
      if (Number.isNaN(date.getTime())) return this.t("common.notSpecified");
      return new Intl.DateTimeFormat(this.currentLocale === "en" ? "en-US" : "ru-RU", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: this.meta.timezone || "Europe/Moscow"
      }).format(date);
    },
    showChartTooltip(point, chart, event) {
      const rect = event.currentTarget.closest(".line-chart").getBoundingClientRect();
      const left = Math.min(rect.width - 150, Math.max(10, event.clientX - rect.left + 12));
      const top = Math.max(10, event.clientY - rect.top - 58);
      this.chartTooltip = {
        chart,
        left,
        top,
        label: point.row.label,
        value: chart === "amount" ? this.formatUsdt(point.row.amount) : this.tc("piece", point.row.count),
        count: chart === "amount" ? this.tc("payment", point.row.count) : this.formatUsdt(point.row.amount)
      };
    },
    formatDuration(minutes) {
      return formatDuration(minutes, this.currentLocale);
    },
    hideChartTooltip() {
      this.chartTooltip = null;
    },
    autosizeTextarea(event) {
      const field = event?.target;
      if (!field) return;
      field.style.height = "auto";
      field.style.height = `${field.scrollHeight}px`;
    },
    toast(message) {
      const item = { id: makeId(), message };
      this.toasts.push(item);
      setTimeout(() => {
        this.toasts = this.toasts.filter((toast) => toast.id !== item.id);
      }, 3200);
    }
  }
};

function translate(locale, key, params = {}) {
  const dictionary = messages[locale] || messages.ru;
  const fallback = messages.ru;
  const value = getPath(dictionary, key) ?? getPath(fallback, key) ?? key;
  return interpolate(value, params);
}

function fallbackCopyText(value) {
  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.left = "-9999px";
  field.style.top = "0";
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(field);
  if (!copied) throw new Error("Copy failed");
}

function translatePlural(locale, key, count, params = {}) {
  const forms = getPath(messages[locale] || messages.ru, `plural.${key}`) || getPath(messages.ru, `plural.${key}`);
  if (!Array.isArray(forms)) return String(count);
  const index = pluralIndex(locale, count);
  return interpolate(forms[index] || forms[forms.length - 1], { ...params, count });
}

function translateList(locale, key) {
  const dictionary = messages[locale] || messages.ru;
  const fallback = messages.ru;
  const value = getPath(dictionary, key) ?? getPath(fallback, key) ?? [];
  return Array.isArray(value) ? value : [];
}

function countryLabelForLocale(code, locale) {
  const countryCode = String(code || "").toUpperCase();
  return countryCode ? countryName(countryCode, locale) : translate(locale, "common.countryEmpty");
}

function countryFlag(code) {
  const countryCode = String(code || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) return "🌐";
  return [...countryCode].map((char) => String.fromCodePoint(127397 + char.charCodeAt(0))).join("");
}

function countryName(code, locale) {
  const countryCode = String(code || "").toUpperCase();
  try {
    const displayNames = new Intl.DisplayNames([locale === "en" ? "en" : "ru"], { type: "region" });
    return displayNames.of(countryCode) || getPath(messages[locale] || messages.ru, `countries.${countryCode}`) || countryCode;
  } catch {
    return getPath(messages[locale] || messages.ru, `countries.${countryCode}`) || countryCode;
  }
}

function getPath(object, path) {
  return String(path).split(".").reduce((value, part) => value?.[part], object);
}

function interpolate(value, params = {}) {
  return String(value).replace(/\{(\w+)\}/g, (_, key) => params[key] ?? "");
}

function buildPdfCanvases(title, headers, rows) {
  const width = 1600;
  const height = 1100;
  const margin = 48;
  const titleHeight = 64;
  const headHeight = 48;
  const rowHeight = 42;
  const colWidths = [250, 430, 360, 260];
  const pages = [];
  let offset = 0;

  while (offset < rows.length || !pages.length) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#111827";
    ctx.font = "700 32px Arial, sans-serif";
    ctx.fillText(title, margin, 56);

    let y = margin + titleHeight;
    drawPdfRow(ctx, headers, margin, y, colWidths, headHeight, true);
    y += headHeight;

    while (offset < rows.length && y + rowHeight <= height - margin) {
      drawPdfRow(ctx, rows[offset], margin, y, colWidths, rowHeight, false);
      y += rowHeight;
      offset += 1;
    }

    pages.push(canvas);
  }

  return pages;
}

function drawPdfRow(ctx, cells, x, y, widths, height, isHead) {
  ctx.font = `${isHead ? "700" : "400"} 18px Arial, sans-serif`;
  ctx.textBaseline = "middle";
  let currentX = x;
  widths.forEach((width, index) => {
    ctx.fillStyle = isHead ? "#111827" : "#ffffff";
    ctx.fillRect(currentX, y, width, height);
    ctx.strokeStyle = "#d1d5db";
    ctx.strokeRect(currentX, y, width, height);
    ctx.fillStyle = isHead ? "#ffffff" : "#111827";
    drawClippedPdfText(ctx, cells[index], currentX + 12, y + height / 2, width - 24);
    currentX += width;
  });
}

function drawClippedPdfText(ctx, value, x, y, maxWidth) {
  let text = String(value ?? "");
  while (text.length > 1 && ctx.measureText(text).width > maxWidth) {
    text = `${text.slice(0, -2)}…`;
  }
  ctx.fillText(text, x, y);
}

function pluralIndex(locale, count) {
  const value = Math.abs(Number(count));
  if (locale === "ru") {
    const mod10 = value % 10;
    const mod100 = value % 100;
    if (mod10 === 1 && mod100 !== 11) return 0;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 1;
    return 2;
  }
  return value === 1 ? 0 : 1;
}

function emptyAsset() {
  return { id: "", type: "vps", name: "", providerId: "", ip: "", domain: "", countryCode: "", inactive: false, sortOrder: Date.now(), expiresAt: toLocalInput(new Date()), payments: [] };
}

function emptyProvider() {
  return { id: "", name: "", loginUrl: "", faviconUrl: "", color: providerFallbackColor(makeId()), note: "" };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function compareAssetsOrder(a, b) {
  const orderA = Number(a.sortOrder ?? 0);
  const orderB = Number(b.sortOrder ?? 0);
  if (orderA !== orderB) return orderA - orderB;
  return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
}

function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toLocalInput(date) {
  const value = new Date(date);
  value.setSeconds(0, 0);
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

function parseAppDate(value) {
  if (!value) return new Date(Number.NaN);
  const raw = String(value);
  const localValue = raw.includes("T") ? raw : `${raw}T00:00`;
  const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(localValue) ? `${localValue}:00` : localValue;
  return /(?:Z|[+-]\d{2}:\d{2})$/.test(withSeconds)
    ? new Date(withSeconds)
    : new Date(`${withSeconds}+03:00`);
}

function formatDuration(minutes, locale = "ru") {
  const total = Math.max(0, Number(minutes || 0));
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  if (days) return `${translatePlural(locale, "day", days)} ${translatePlural(locale, "hour", hours)}`;
  if (hours) return `${translatePlural(locale, "hour", hours)} ${translatePlural(locale, "minute", mins)}`;
  return translatePlural(locale, "minute", mins);
}

function viewFromPath(pathname) {
  const path = String(pathname || "/").replace(/\/+$/, "") || "/";
  return ({
    "/": "assets",
    "/providers": "providers",
    "/stats": "stats",
    "/alerts": "alerts",
    "/logs": "logs",
    "/guide": "guide",
    "/settings": "settings"
  })[path] || "assets";
}

function pathFromView(view) {
  return ({
    assets: "/",
    providers: "/providers",
    stats: "/stats",
    alerts: "/alerts",
    logs: "/logs",
    guide: "/guide",
    settings: "/settings"
  })[view] || "/";
}

function periodStart(period) {
  if (period === "all") return null;
  const days = ({ "7d": 7, "30d": 30, "90d": 90, "180d": 180, "1y": 365 })[period] || 90;
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function maxNotificationLeadMinutes(value) {
  const leads = String(value || "5m,2h,1d,3d,5d")
    .split(",")
    .map((item) => parseDurationToken(item.trim()))
    .filter(Boolean);
  return Math.max(...leads.map((lead) => lead.minutes), 1);
}

function parseDurationToken(value) {
  const match = String(value || "").toLowerCase().match(/^(\d+)(m|h|d)$/);
  if (!match) return null;
  const amount = Number(match[1]);
  const multiplier = match[2] === "m" ? 1 : match[2] === "h" ? 60 : 1440;
  return amount > 0 ? { amount, unit: match[2], minutes: amount * multiplier } : null;
}

function sumPaymentsBoth(payments = []) {
  return payments.reduce((acc, payment) => {
    acc.usdt += Number(payment.usdt || 0);
    acc.rub += Number(payment.rub || 0);
    return acc;
  }, { usdt: 0, rub: 0 });
}

function buildPaymentTimeline(payments, period, locale = "ru", timezone = "Europe/Moscow") {
  const now = new Date();
  const validPayments = payments
    .map((payment) => ({ ...payment, date: parseAppDate(payment.paidAt) }))
    .filter((payment) => !Number.isNaN(payment.date.getTime()));
  const since = periodStart(period) || validPayments.reduce((min, payment) => payment.date < min ? payment.date : min, new Date(now.getTime() - 90 * 86400_000));
  const stepHours = ({ "7d": 6, "30d": 24, "90d": 24, "180d": 72, "1y": 168, all: 168 })[period] || 24;
  const stepMs = stepHours * 3600_000;
  const start = alignTimelineStart(since, stepHours);
  const rows = [];
  for (let time = start.getTime(); time <= now.getTime() + stepMs; time += stepMs) {
    const date = new Date(time);
    rows.push({
      time,
      label: formatTimelineLabel(date, stepHours, locale, timezone),
      amount: 0,
      count: 0
    });
  }
  for (const payment of validPayments) {
    const index = Math.floor((payment.date.getTime() - start.getTime()) / stepMs);
    if (rows[index]) {
      rows[index].amount += Number(payment.usdt || 0);
      rows[index].count += 1;
    }
  }
  return rows.slice(-80);
}

function alignTimelineStart(date, stepHours) {
  const value = new Date(date);
  value.setMinutes(0, 0, 0);
  if (stepHours >= 24) value.setHours(0);
  else value.setHours(Math.floor(value.getHours() / stepHours) * stepHours);
  return value;
}

function formatTimelineLabel(date, stepHours, locale = "ru", timezone = "Europe/Moscow") {
  const intlLocale = locale === "en" ? "en-US" : "ru-RU";
  if (stepHours < 24) {
    return new Intl.DateTimeFormat(intlLocale, { day: "2-digit", month: "2-digit", hour: "2-digit", timeZone: timezone }).format(date);
  }
  return new Intl.DateTimeFormat(intlLocale, { day: "2-digit", month: "2-digit", timeZone: timezone }).format(date);
}

function linePoints(rows, key) {
  if (!rows.length) return "";
  const max = Math.max(1, ...rows.map((row) => Number(row[key] || 0)));
  const last = Math.max(1, rows.length - 1);
  return rows.map((row, index) => {
    const x = rows.length === 1 ? 50 : (index / last) * 100;
    const y = 38 - (Number(row[key] || 0) / max) * 32;
    return `${roundPoint(x)},${roundPoint(y)}`;
  }).join(" ");
}

function chartHits(rows, key) {
  if (!rows.length) return [];
  const max = Math.max(1, ...rows.map((row) => Number(row[key] || 0)));
  const last = Math.max(1, rows.length - 1);
  const hitWidth = rows.length === 1 ? 100 : 100 / rows.length;
  return rows.map((row, index) => {
    const x = rows.length === 1 ? 50 : (index / last) * 100;
    const y = 38 - (Number(row[key] || 0) / max) * 32;
    return {
      key: `${key}-${row.time}`,
      x: roundPoint(Math.max(0, x - hitWidth / 2)),
      width: roundPoint(index === rows.length - 1 ? 100 - Math.max(0, x - hitWidth / 2) : hitWidth),
      point: { x: roundPoint(x), y: roundPoint(y), row }
    };
  });
}

function areaPoints(rows, key) {
  const points = linePoints(rows, key);
  if (!points) return "";
  return `0,40 ${points} 100,40`;
}

function roundPoint(value) {
  return Math.round(value * 100) / 100;
}

function providerFallbackColor(seed = "provider") {
  let hash = 0;
  for (const char of String(seed)) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  const hue = Math.abs(hash) % 360;
  return hslToHex(hue, 68, 54);
}

function hslToHex(hue, saturation, lightness) {
  const s = saturation / 100;
  const l = lightness / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
  const m = l - c / 2;
  const [r, g, b] = hue < 60 ? [c, x, 0]
    : hue < 120 ? [x, c, 0]
    : hue < 180 ? [0, c, x]
    : hue < 240 ? [0, x, c]
    : hue < 300 ? [x, 0, c]
    : [c, 0, x];
  return `#${[r, g, b].map((value) => Math.round((value + m) * 255).toString(16).padStart(2, "0")).join("")}`;
}
</script>
