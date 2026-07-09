<template>
  <section>
    <section class="toolbar">
      <div class="search-row">
        <input v-model="app.search" type="search" :placeholder="app.t('assets.search')">
        <select v-model="app.typeFilter" :aria-label="app.t('common.type')">
          <option value="all">{{ app.t("assets.allTypes") }}</option>
          <option value="inactive">{{ app.t("assets.inactive") }}</option>
          <option value="vps">{{ app.t("typePlural.vps") }}</option>
          <option value="domain">{{ app.t("typePlural.domain") }}</option>
          <option value="certificate">{{ app.t("typePlural.certificate") }}</option>
        </select>
      </div>
      <button class="primary-button" type="button" @click="app.openAsset()"><PlusIcon :size="18" />{{ app.t("assets.add") }}</button>
    </section>
<div class="form-group">
  <label>{{ t('payments.currency') }}</label>
  <select v-model="paymentForm.currency">
    <option value="USDT">USDT</option>
    <option value="RUB">RUB</option>
  </select>
</div>

<div class="form-group">
  <label>{{ t('payments.author') }}</label>
  <select v-model="paymentForm.author_id">
    <option v-for="author in authors" :key="author.id" :value="author.id">
      {{ author.name }}
    </option>
  </select>
</div>
    <section class="view active">
      <div class="asset-sections" v-if="app.filteredAssets.length">
        <section v-for="group in app.assetGroups" :key="group.type" class="asset-type-section">
          <div v-if="app.typeFilter === 'all'" class="asset-type-head">
            <h2>{{ group.label }}</h2>
            <span>{{ app.tc("piece", group.items.length) }}</span>
          </div>
          <div class="asset-grid">
            <article
              v-for="asset in group.items"
              :key="asset.id"
              class="asset-card"
              :class="[app.dueStateClass(asset.expiresAt), { dragging: app.draggedAssetId === asset.id }]"
              draggable="true"
              @dragstart="app.startAssetDrag(asset, $event)"
              @dragover.prevent
              @drop="app.dropAsset(asset)"
              @dragend="app.endAssetDrag"
            >
              <header>
                <div class="card-title-row">
                  <img v-if="app.providerOf(asset)?.faviconUrl" class="favicon" :src="app.providerOf(asset).faviconUrl" alt="" referrerpolicy="no-referrer">
                  <span v-else class="favicon-placeholder">{{ app.providerInitial(asset) }}</span>
                  <div>
                    <h2>{{ asset.name }}</h2>
                    <span v-if="asset.type === 'vps'">{{ app.assetSubtitle(asset) }}</span>
                    <a v-else-if="asset.domain" class="card-subtitle-link" :href="app.domainHref(asset.domain)" target="_blank" rel="noreferrer">{{ asset.domain }}</a>
                    <span v-else>{{ app.assetSubtitle(asset) }}</span>
                  </div>
                </div>
                <span class="pill">{{ app.formatDateTime(asset.expiresAt) }}</span>
              </header>
              <div class="meta-list">
                <span>{{ app.t("assets.metaProvider", { value: app.providerOf(asset)?.name || app.t("common.providerEmpty") }) }}</span>
                <span v-if="asset.type === 'vps' && asset.ip" class="ip-meta">
                  <span>IP:</span>
                  <button class="meta-copy-button" type="button" :title="app.t('assets.copyIp')" @click="app.copyIp(asset.ip)">{{ asset.ip }}</button>
                </span>
                <span>{{ app.daysText(asset.expiresAt) }}</span>
              </div>
              <div class="payment-strip">
                <strong>{{ app.formatUsdt(app.totalPayments(asset.payments)) }}</strong>
                <span>{{ app.tc("payment", asset.payments?.length || 0) }}</span>
              </div>
              <footer>
                <a v-if="app.providerOf(asset)?.loginUrl" class="secondary-link icon-only tooltip" :href="app.providerOf(asset).loginUrl" target="_blank" rel="noreferrer" :aria-label="app.t('common.cabinet')" :data-tooltip="app.t('common.cabinet')"><ExternalLinkIcon :size="16" /></a>
                <span v-else></span>
                <div class="card-actions">
                  <button class="secondary-button icon-only tooltip" type="button" @click="app.openPayments(asset)" :aria-label="app.t('common.payments')" :data-tooltip="app.t('common.payments')"><CreditCardIcon :size="16" /></button>
                  <button class="secondary-button icon-only tooltip" type="button" @click="app.openExpire(asset)" :aria-label="app.t('common.term')" :data-tooltip="app.t('common.term')"><CalendarClockIcon :size="16" /></button>
                  <button class="secondary-button icon-only tooltip" type="button" @click="app.toggleAssetInactive(asset, !asset.inactive)" :aria-label="asset.inactive ? app.t('assets.activate') : app.t('assets.deactivate')" :data-tooltip="asset.inactive ? app.t('assets.activate') : app.t('assets.deactivate')">
                    <RotateCcwIcon v-if="asset.inactive" :size="16" />
                    <ArchiveXIcon v-else :size="16" />
                  </button>
                  <button class="secondary-button icon-only tooltip" type="button" @click="app.openAsset(asset)" :aria-label="app.t('common.open')" :data-tooltip="app.t('common.open')"><PencilIcon :size="16" /></button>
                </div>
              </footer>
            </article>
          </div>
        </section>
      </div>
      <div v-else class="empty-state visible">
        <h1>{{ app.t("assets.emptyTitle") }}</h1>
        <p>{{ app.t("assets.emptyText") }}</p>
        <button class="primary-button" type="button" @click="app.openAsset()"><PlusIcon :size="18" />{{ app.t("assets.add") }}</button>
      </div>
    </section>
  </section>
</template>

<script>
import { ArchiveX as ArchiveXIcon, CalendarClock as CalendarClockIcon, CreditCard as CreditCardIcon, ExternalLink as ExternalLinkIcon, Pencil as PencilIcon, Plus as PlusIcon, RotateCcw as RotateCcwIcon } from "@lucide/vue";

export default {
  components: { ArchiveXIcon, CalendarClockIcon, CreditCardIcon, ExternalLinkIcon, PencilIcon, PlusIcon, RotateCcwIcon },
  props: {
    app: { type: Object, required: true }
  }
};
</script>
