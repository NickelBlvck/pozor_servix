<template>
  <section class="view active alerts-view">
    <div class="section-head alerts-head">
      <div>
        <h1>{{ app.t("nav.alerts") }}</h1>
      </div>
      <div class="alerts-counter">
        <BellIcon :size="18" />
        <strong>{{ app.alerts.length }}</strong>
      </div>
    </div>

    <div class="alerts-status-panel" :class="{ configured: app.meta.telegramConfigured }">
      <span class="alerts-status-icon"><BellIcon :size="18" /></span>
      <span>{{ app.telegramStatus }}</span>
    </div>

    <div class="alert-list" v-if="app.alerts.length">
      <article v-for="item in app.alerts" :key="item.id" class="alert-item" :class="app.dueStateClass(item.date)">
        <div class="alert-icon"><CalendarClockIcon :size="18" /></div>
        <div class="alert-main">
          <strong>{{ item.title }}</strong>
          <div class="alert-meta">
            <span>{{ app.formatDateTime(item.date) }}</span>
            <span>{{ app.alertWhen(item) }}</span>
          </div>
        </div>
        <button class="secondary-button icon-only tooltip" type="button" @click="app.openAsset(app.assetById(item.assetId))" :aria-label="app.t('common.open')" :data-tooltip="app.t('common.open')"><PencilIcon :size="16" /></button>
      </article>
    </div>
    <div v-else class="empty-state visible alert-empty">
      <BellIcon :size="42" />
      <h1>{{ app.t("alerts.emptyTitle") }}</h1>
      <p>{{ app.t("alerts.emptyText") }}</p>
    </div>
  </section>
</template>

<script>
import { Bell as BellIcon, CalendarClock as CalendarClockIcon, Pencil as PencilIcon } from "@lucide/vue";

export default {
  components: { BellIcon, CalendarClockIcon, PencilIcon },
  props: {
    app: { type: Object, required: true }
  }
};
</script>
