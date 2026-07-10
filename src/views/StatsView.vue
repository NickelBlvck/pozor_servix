<template>
  <section class="view active">
    <div class="section-head">
      <h1>{{ app.t("nav.stats") }}</h1>
      <select v-model="app.statsPeriod" class="period-select" :aria-label="app.t('stats.period')">
        <option value="7d">{{ app.t("stats.period7d") }}</option>
        <option value="30d">{{ app.t("stats.period30d") }}</option>
        <option value="90d">{{ app.t("stats.period90d") }}</option>
        <option value="180d">{{ app.t("stats.period180d") }}</option>
        <option value="1y">{{ app.t("stats.period1y") }}</option>
        <option value="all">{{ app.t("stats.periodAll") }}</option>
      </select>
    </div>
    <div class="stats-grid">
      <article v-for="card in app.statCards" :key="card.label" class="stat-card"><span>{{ card.label }}</span><strong>{{ card.value }}</strong></article>
    </div>
    <article class="chart-panel forecast-panel">
      <div class="chart-title-row">
        <h2>{{ app.t("stats.forecastTitle") }}</h2>
        <span>{{ app.formatBoth(app.nextMonthForecastTotals) }}</span>
      </div>
      <p class="forecast-note">{{ app.t("stats.forecastHint") }}</p>
      <div v-if="app.nextMonthForecast.length" class="forecast-list">
        <div v-for="item in app.nextMonthForecast" :key="item.asset.id">
          <span>
            <strong>{{ item.asset.name }}</strong>
            <small>{{ app.typeLabel(item.asset.type) }} · {{ app.formatDateTime(item.dueAt) }}</small>
          </span>
          <strong>{{ app.formatBoth(app.totalsBoth([item.payment])) }}</strong>
        </div>
      </div>
      <div v-else class="inline-empty">{{ app.t("stats.forecastEmpty") }}</div>
    </article>
    <div class="charts-grid">
      <article class="chart-panel wide-chart">
        <div class="chart-title-row">
          <h2>{{ app.t("stats.spendByUnit", { unit: app.timelineUnitLabel }) }}</h2>
          <span>{{ app.formatUsdt(app.timelineTotal) }}</span>
        </div>
        <div class="line-chart" v-if="app.paymentAmountTimeline.length" @mouseleave="app.hideChartTooltip">
          <svg viewBox="0 0 100 42" preserveAspectRatio="none" aria-hidden="true">
            <polyline class="line-fill" :points="app.paymentAmountAreaPoints"></polyline>
            <polyline class="line-main" :points="app.paymentAmountPoints"></polyline>
            <rect v-for="hit in app.paymentAmountHits" :key="hit.key" class="line-hit" :x="hit.x" y="0" :width="hit.width" height="42" @mouseenter="app.showChartTooltip(hit.point, 'amount', $event)" @mousemove="app.showChartTooltip(hit.point, 'amount', $event)"></rect>
          </svg>
          <div v-if="app.chartTooltip?.chart === 'amount'" class="chart-tooltip" :style="{ left: app.chartTooltip.left + 'px', top: app.chartTooltip.top + 'px' }">
            <strong>{{ app.chartTooltip.label }}</strong>
            <span>{{ app.chartTooltip.value }}</span>
            <small>{{ app.chartTooltip.count }}</small>
          </div>
          <div class="line-axis">
            <span v-for="label in app.timelineAxisLabels" :key="label">{{ label }}</span>
          </div>
        </div>
        <div v-else class="inline-empty">{{ app.t("stats.paymentsNone") }}</div>
      </article>
      <article class="chart-panel">
        <h2>{{ app.t("stats.providerSpend") }}</h2>
        <div class="bar-list" v-if="app.providerSpend.length">
          <div v-for="row in app.providerSpend" :key="row.id" class="bar-row">
            <span><i :style="{ background: row.color }"></i>{{ row.name }}</span><div><i :style="{ width: row.width + '%', background: row.color }"></i></div><strong>{{ app.formatUsdt(row.value) }}</strong>
          </div>
        </div>
        <div v-else class="inline-empty">{{ app.t("stats.spendNone") }}</div>
      </article>
      <article class="chart-panel">
        <div class="chart-title-row">
          <h2>{{ app.t("stats.paymentCount") }}</h2>
          <span>{{ app.tc("piece", app.periodPayments.length) }}</span>
        </div>
        <div class="line-chart compact-line" v-if="app.paymentCountTimeline.length" @mouseleave="app.hideChartTooltip">
          <svg viewBox="0 0 100 42" preserveAspectRatio="none" aria-hidden="true">
            <polyline class="line-fill count-line" :points="app.paymentCountAreaPoints"></polyline>
            <polyline class="line-main count-line" :points="app.paymentCountPoints"></polyline>
            <rect v-for="hit in app.paymentCountHits" :key="hit.key" class="line-hit" :x="hit.x" y="0" :width="hit.width" height="42" @mouseenter="app.showChartTooltip(hit.point, 'count', $event)" @mousemove="app.showChartTooltip(hit.point, 'count', $event)"></rect>
          </svg>
          <div v-if="app.chartTooltip?.chart === 'count'" class="chart-tooltip" :style="{ left: app.chartTooltip.left + 'px', top: app.chartTooltip.top + 'px' }">
            <strong>{{ app.chartTooltip.label }}</strong>
            <span>{{ app.chartTooltip.value }}</span>
            <small>{{ app.chartTooltip.count }}</small>
          </div>
          <div class="line-axis">
            <span v-for="label in app.timelineAxisLabels" :key="label">{{ label }}</span>
          </div>
        </div>
        <div v-else class="inline-empty">{{ app.t("stats.paymentsNone") }}</div>
      </article>
    </div>
    <article class="chart-panel table-panel">
      <div class="table-title-row">
        <div>
          <h2>{{ app.t("stats.allPayments") }}</h2>
          <span>{{ app.t("stats.shownOf", { shown: app.filteredPeriodPayments.length, total: app.tc("payment", app.periodPayments.length) }) }}</span>
        </div>
        <div class="export-actions">
          <button class="secondary-button" type="button" @click="app.exportPaymentsCsv" :disabled="!app.filteredPeriodPayments.length"><DownloadIcon :size="16" />CSV</button>
          <button class="secondary-button" type="button" @click="app.exportPaymentsPdf" :disabled="!app.filteredPeriodPayments.length"><FileTextIcon :size="16" />PDF</button>
        </div>
      </div>
      <div class="table-toolbar" v-if="app.periodPayments.length">
        <input v-model="app.paymentTableSearch" type="search" :placeholder="app.t('stats.filter')">
        <select v-model="app.paymentTableProvider" :aria-label="app.t('stats.providerFilter')">
          <option value="all">{{ app.t("stats.allProviders") }}</option>
          <option value="none">{{ app.t("common.providersEmpty") }}</option>
          <option v-for="provider in app.paymentTableProviders" :key="provider.id" :value="provider.id">{{ provider.name }}</option>
        </select>
        <select v-model="app.paymentTableAuthor" :aria-label="app.t('stats.authorFilter')">
          <option value="all">{{ app.t("stats.allAuthors") }}</option>
          <option value="none">{{ app.t("payments.noAuthor") }}</option>
          <option v-for="author in app.paymentTableAuthors" :key="author.id" :value="author.id">{{ author.name }}</option>
        </select>
        <select v-model="app.paymentTableSort" :aria-label="app.t('stats.sort')">
          <option value="date-desc">{{ app.t("stats.sortDateDesc") }}</option>
          <option value="date-asc">{{ app.t("stats.sortDateAsc") }}</option>
          <option value="amount-desc">{{ app.t("stats.sortAmountDesc") }}</option>
          <option value="amount-asc">{{ app.t("stats.sortAmountAsc") }}</option>
          <option value="server-asc">{{ app.t("stats.sortServerAsc") }}</option>
          <option value="provider-asc">{{ app.t("stats.sortProviderAsc") }}</option>
        </select>
        <select v-model.number="app.paymentTablePageSize" :aria-label="app.t('stats.pageSize')">
          <option :value="10">10</option>
          <option :value="25">25</option>
          <option :value="50">50</option>
          <option :value="100">100</option>
        </select>
      </div>
      <div class="payments-table" v-if="app.paginatedPeriodPayments.length">
        <div class="payments-table-head"><span>{{ app.t("common.date") }}</span><span>{{ app.t("type.vps") }}</span><span>{{ app.t("common.provider") }}</span><span>{{ app.t("payments.author") }}</span><span>{{ app.t("common.sum") }}</span></div>
        <div v-for="payment in app.paginatedPeriodPayments" :key="payment.id" class="payments-table-row">
          <span>{{ app.formatDateTime(payment.paidAt) }}</span>
          <span>{{ payment.asset.name }}</span>
          <span>{{ app.providerOf(payment.asset)?.name || app.t("common.providerEmpty") }}</span>
          <span>{{ payment.authorName || "—" }}</span>
          <strong>{{ app.paymentDisplay(payment) }}</strong>
        </div>
      </div>
      <div v-else-if="app.periodPayments.length" class="inline-empty">{{ app.t("stats.noFilteredPayments") }}</div>
      <div v-else class="inline-empty">{{ app.t("stats.noPeriodPayments") }}</div>
      <div class="table-footer" v-if="app.filteredPeriodPayments.length">
        <span>{{ app.t("common.total") }}: {{ app.filteredPeriodPaymentsTotal }}</span>
        <div class="pagination">
          <button class="secondary-button icon-only" type="button" @click="app.setPaymentPage(app.paymentTablePage - 1)" :disabled="app.paymentTablePage <= 1" :aria-label="app.t('stats.prevPage')"><ChevronLeftIcon :size="16" /></button>
          <strong>{{ app.paymentTablePage }} / {{ app.paymentTablePages }}</strong>
          <button class="secondary-button icon-only" type="button" @click="app.setPaymentPage(app.paymentTablePage + 1)" :disabled="app.paymentTablePage >= app.paymentTablePages" :aria-label="app.t('stats.nextPage')"><ChevronRightIcon :size="16" /></button>
        </div>
      </div>
    </article>
  </section>
</template>

<script>
import { ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon, Download as DownloadIcon, FileText as FileTextIcon } from "@lucide/vue";

export default {
  components: { ChevronLeftIcon, ChevronRightIcon, DownloadIcon, FileTextIcon },
  props: {
    app: { type: Object, required: true }
  }
};
</script>
