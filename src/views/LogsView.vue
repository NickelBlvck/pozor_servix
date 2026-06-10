<template>
  <section class="view active">
    <div class="section-head">
      <h1>{{ app.t("nav.logs") }}</h1>
      <button class="secondary-button" type="button" @click="app.loadLogs"><ScrollTextIcon :size="18" />{{ app.t("logs.refresh") }}</button>
    </div>
    <article class="chart-panel table-panel">
      <div class="table-toolbar">
        <input v-model="app.logSearch" type="search" :placeholder="app.t('logs.search')">
        <select v-model="app.logActionFilter" :aria-label="app.t('logs.action')">
          <option value="all">{{ app.t("logs.allActions") }}</option>
          <option v-for="action in app.logActions" :key="action" :value="action">{{ action }}</option>
        </select>
        <select v-model="app.logSort" :aria-label="app.t('stats.sort')">
          <option value="date-desc">{{ app.t("stats.sortDateDesc") }}</option>
          <option value="date-asc">{{ app.t("stats.sortDateAsc") }}</option>
        </select>
        <select v-model.number="app.logPageSize" :aria-label="app.t('logs.pageSize')">
          <option :value="10">10</option>
          <option :value="25">25</option>
          <option :value="50">50</option>
          <option :value="100">100</option>
        </select>
      </div>
      <div class="logs-table" v-if="app.paginatedLogs.length">
        <div class="logs-table-head"><span>{{ app.t("logs.time") }}</span><span>{{ app.t("logs.action") }}</span><span>{{ app.t("logs.path") }}</span><span>{{ app.t("logs.ip") }}</span><span>{{ app.t("logs.details") }}</span></div>
        <div v-for="item in app.paginatedLogs" :key="item.id" class="logs-table-row">
          <span>{{ app.formatDateTime(item.at) }}</span>
          <strong>{{ item.action }}</strong>
          <span>{{ item.method }} {{ item.path }}</span>
          <span>{{ item.ip || "-" }}</span>
          <code>{{ app.logDetails(item) }}</code>
        </div>
      </div>
      <div v-else class="inline-empty">{{ app.t("logs.empty") }}</div>
      <div class="table-footer" v-if="app.filteredLogs.length">
        <span>{{ app.t("stats.shownOf", { shown: app.paginatedLogs.length, total: app.tc("record", app.filteredLogs.length) }) }}</span>
        <div class="pagination">
          <button class="secondary-button icon-only" type="button" @click="app.setLogPage(app.logPage - 1)" :disabled="app.logPage <= 1" :aria-label="app.t('stats.prevPage')"><ChevronLeftIcon :size="16" /></button>
          <strong>{{ app.currentLogPage }} / {{ app.logPages }}</strong>
          <button class="secondary-button icon-only" type="button" @click="app.setLogPage(app.logPage + 1)" :disabled="app.logPage >= app.logPages" :aria-label="app.t('stats.nextPage')"><ChevronRightIcon :size="16" /></button>
        </div>
      </div>
    </article>
  </section>
</template>

<script>
import { ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon, ScrollText as ScrollTextIcon } from "@lucide/vue";

export default {
  components: { ChevronLeftIcon, ChevronRightIcon, ScrollTextIcon },
  props: {
    app: { type: Object, required: true }
  }
};
</script>
