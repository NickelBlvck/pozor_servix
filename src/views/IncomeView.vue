<template>
  <section class="view active">
    <div class="section-head">
      <div><h1>{{ app.t('income.title') }}</h1><p>{{ app.t('income.subtitle') }}</p></div>
      <button class="secondary-button" type="button" @click="load" :disabled="loading"><RefreshCwIcon :size="16" />{{ app.t('logs.refresh') }}</button>
    </div>

    <div class="stats-grid income-summary">
      <article class="stat-card"><span>{{ app.t('income.freeMoney') }}</span><strong>{{ formatTotals(freeTotals) }}</strong></article>
      <article class="stat-card"><span>{{ app.t('income.plategaMoney') }}</span><strong>{{ formatTotals(plategaTotals) }}</strong><small v-if="platega.error">{{ platega.error }}</small></article>
      <article class="stat-card"><span>{{ app.t('income.otherMoney') }}</span><strong>{{ formatTotals(otherTotals) }}</strong></article>
      <article class="stat-card"><span>{{ app.t('income.receipts') }}</span><strong>{{ incomes.length }}</strong></article>
    </div>

    <div v-if="!loading && !platega.balances.length && !incomes.length" class="inline-empty income-empty-state">
      <div><strong>{{ app.t('income.emptyStateTitle') }}</strong></div>
      <div>{{ app.t('income.emptyStateText') }}</div>
    </div>

    <article class="chart-panel income-balance-panel">
      <div class="chart-title-row">
        <h2>{{ app.t('income.plategaBalances') }}</h2>
        <span>{{ app.t('income.plategaBalancesHelp') }}</span>
      </div>
      <div v-if="platega.balances.length" class="balance-list">
        <div v-for="balance in platega.balances" :key="balance.currency" class="balance-row">
          <span><strong>{{ balance.currency }}</strong></span>
          <span>{{ formatMoney(balance.amount, balance.currency) }}</span>
          <small v-if="balance.frozenBalance > 0">{{ app.t('income.frozenBalance', { amount: formatMoney(balance.frozenBalance, balance.currency) }) }}</small>
        </div>
      </div>
      <div v-else class="inline-empty">
        <div>{{ platega.error || app.t('income.plategaEmpty') }}</div>
        <div class="income-hint">{{ app.t('income.plategaHint') }}</div>
      </div>
    </article>

    <article v-if="statsData" class="chart-panel income-charts">
      <div class="charts-grid">
        <article class="chart-panel pie-chart">
          <div class="chart-title-row">
            <h2>{{ app.t('income.byCategory') }}</h2>
            <span>{{ formatTotals(freeTotals) }}</span>
          </div>
          <svg viewBox="0 0 100 54" aria-hidden="true" v-if="statsData.categoryTotals">
            <circle :cx="50" :cy="27" :r="18.6" fill="none" stroke-width="3.6"/>
            <template v-for="(slice, index) in Object.entries(statsData.categoryTotals)" :key="index">
              <circle :cx="50" :cy="27" r="18.6" stroke-width="3.6" :stroke="getCategoryColor(slice[0])" 
                :stroke-dasharray="(slice[1] / (Object.values(statsData.categoryTotals).reduce((a, b) => a + b, 0)) * Math.PI * 37.2)"
                :stroke-dashoffset="-((index - Object.keys(statsData.categoryTotals).length / 2) * (360 / Object.keys(statsData.categoryTotals).length) / 100 * 251.2)" fill="none"/>
            </template>
          </svg>
          <div class="legend" v-if="statsData.categoryTotals">
            <span v-for="(amount, currency) in statsData.categoryTotals" :key="currency" style="color: getLegendColor(currency)">
              {{ formatMoney(amount, currency) }}
            </span>
          </div>
        </article>
        <article class="chart-panel line-chart">
          <div class="chart-title-row">
            <h2>{{ app.t('income.dynamics') }}</h2>
            <select v-model="statsPeriod" class="period-select" :aria-label="app.t('stats.period')">
              <option value="7d">{{ app.t("stats.period7d") }}</option>
              <option value="30d">{{ app.t("stats.period30d") }}</option>
              <option value="90d">{{ app.t("stats.period90d") }}</option>
            </select>
          </div>
          <svg viewBox="0 0 100 42" preserveAspectRatio="none" aria-hidden="true" v-if="statsData.amountPoints">
            <polyline class="line-fill" :points="statsData.amountPoints"/>
            <polyline class="line-main" :points="statsData.amountPoints"/>
          </svg>
          <div v-if="statsData.amountPoints" class="line-axis">
            <span v-for="(date, i) in statsData.incomeTimeline.slice(-5).reverse()" :key="i">{{ date }}</span>
          </div>
        </article>
      </div>
    </article>

    <div class="income-layout">
      <form class="chart-panel income-form" @submit.prevent="addIncome">
        <div class="chart-title-row"><h2>{{ app.t('income.add') }}</h2></div>
        <div class="form-grid compact-grid">
          <label>{{ app.t('income.name') }}<input v-model="form.name" type="text" required></label>
          <label>{{ app.t('income.amount') }}<input v-model.number="form.amount" type="number" min="0.01" step="0.01" required></label>
          <label>{{ app.t('payments.author') }}<select v-model="form.authorId"><option value="">{{ app.t('payments.noAuthor') }}</option><option v-for="author in authors" :key="author.id" :value="author.id">{{ author.name }}</option></select></label>
          <label>{{ app.t('income.balance') }}<input v-model="form.balanceName" type="text" :placeholder="app.t('income.balancePlaceholder')" required></label>
        </div>
        <button class="primary-button" type="submit"><PlusIcon :size="18" />{{ app.t('income.add') }}</button>
      </form>

      <article class="chart-panel income-list-panel">
        <div class="chart-title-row"><h2>{{ app.t('income.manualReceipts') }}</h2><span>{{ incomes.length }}</span></div>
        <div v-if="incomes.length" class="income-list">
          <div v-for="income in incomes" :key="income.id">
            <span><strong>{{ income.name }}</strong><small>{{ income.balanceName }} · {{ income.authorName || app.t('payments.noAuthor') }} · {{ app.formatDateTime(income.receivedAt) }}</small></span>
            <strong>{{ formatMoney(income.amount, income.currency) }}</strong>
            <button class="icon-button" type="button" :aria-label="app.t('common.delete')" @click="deleteIncome(income.id)"><Trash2Icon :size="16" /></button>
          </div>
        </div>
        <div v-else class="inline-empty">{{ app.t('income.empty') }}</div>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Plus as PlusIcon, RefreshCw as RefreshCwIcon, Trash2 as Trash2Icon } from '@lucide/vue'

const props = defineProps({ app: { type: Object, required: true } })
const incomes = ref([])
const authors = ref([])
const statsPeriod = ref('30d')
const loading = ref(false)
const platega = ref({ configured: false, balances: [], error: '' })
const statsData = ref(null)

function getCategoryColor(currency) {
  const colors = ['#2563eb', '#16a34a', '#dc2626', '#9333ea', '#0891b2', '#f59e0b']
  return colors[Object.keys(statsData.categoryTotals || {}).indexOf(currency) % colors.length] || '#64748b'
}

function getLegendColor(currency) {
  const hues = [220, 142, 350, 270, 180, 45]
  return `hsl(${(hues[Object.keys(statsData.categoryTotals || {}).indexOf(currency) % hues.length] + 180) % 360}, 70%, 50%)`
}

const form = reactive({ name: '', amount: '', currency: 'RUB', authorId: '', balanceName: '' })

function addToTotals(totals, currency, amount) {
  totals[currency] = (totals[currency] || 0) + Number(amount || 0)
  return totals
}

const plategaTotals = computed(() => (platega.value.balances || []).reduce((totals, item) => addToTotals(totals, item.currency, item.amount), {}))
const otherTotals = computed(() => incomes.value.reduce((totals, item) => addToTotals(totals, item.currency, item.amount), {}))
const freeTotals = computed(() => {
  const result = { ...plategaTotals.value }
  for (const [currency, amount] of Object.entries(otherTotals.value)) addToTotals(result, currency, amount)
  return result
})

function formatMoney(amount, currency) {
  return currency === 'RUB' ? props.app.formatRub(amount) : props.app.formatUsdt(amount)
}

function formatTotals(totals) {
  const values = Object.entries(totals).filter(([, amount]) => Number(amount)).map(([currency, amount]) => formatMoney(amount, currency))
  return values.length ? values.join(' · ') : '—'
}

async function load() {
  loading.value = true
  try {
    const summaryPromise = props.app.api('/api/incomes/summary').catch((error) => ({ error: error.message, platega: { configured: false, balances: [], error: error.message } }))
    const listPromise = props.app.api('/api/incomes').catch((error) => ({ error: error.message, items: [], authors: [] }))
    const statsPromise = props.app.api(`/api/income/stats?period=${statsPeriod.value}`).catch((error) => null)
    const [summary, list, stats] = await Promise.all([summaryPromise, listPromise, statsPromise])
    if (summary.error) props.app.toast(summary.error)
    if (list.error) props.app.toast(list.error)
    platega.value = summary.platega || platega.value
    incomes.value = summary.error ? list.items || [] : (Array.isArray(summary.incomes) ? summary.incomes : list.items || [])
    authors.value = list.authors || []
    if (stats && stats.incomeTimeline) {
      const periodPayments = stats.incomeTimeline.map((item, index) => ({ ...item, date: new Date(item.receivedAt).toISOString() }))
      const amountPoints = periodPayments.map((p, i) => `M${i * 3.33},${42 - (p.amount / Math.max(...periodPayments.map(x => x.amount)) * 42)}`).join(' ')
      const countPoints = periodPayments.map((p, i) => `M${i * 3.33},${42 - (p.count / Math.max(...periodPayments.map(x => p.count)) * 42)}`).join(' ')
      statsData.value = { ...stats, amountPoints, countPoints }
    } else {
      statsData.value = null
    }
  } catch (error) {
    props.app.toast(error.message)
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    const result = await props.app.api(`/api/income/stats?period=${statsPeriod.value}`).catch((error) => ({ error: error.message }))
    if (result.error && !result.incomeTimeline) return
    statsData.value = { 
      ...result, 
      amountPoints: result.incomeTimeline.length ? result.incomeTimeline.map((p, i) => `M${i * 3.33},${42 - (p.amount / Math.max(...result.incomeTimeline.map(x => x.amount)) * 42)}`).join(' ') : '',
      countPoints: result.incomeTimeline.length ? result.incomeTimeline.map((p, i) => `M${i * 3.33},${42 - (1 / Math.max(...result.incomeTimeline.map(x => p.count)) * 42)}`).join(' ') : ''
    }
    return
  } catch (error) {
    props.app.toast(error.message)
  }
}

loadStats()

watch(
  () => statsPeriod.value,
  async (newVal) => {
    await loadStats()
  }
)

async function addIncome() {
  try {
    await props.app.api('/api/incomes', { method: 'POST', body: JSON.stringify(form) })
    Object.assign(form, { name: '', amount: '', currency: 'RUB', authorId: '', balanceName: '' })
    await load()
    props.app.toast(props.app.t('income.saved'))
  } catch (error) {
    props.app.toast(error.message)
  }
}

async function deleteIncome(id) {
  if (!confirm(props.app.t('income.deleteConfirm'))) return
  try {
    await props.app.api(`/api/incomes/${id}`, { method: 'DELETE' })
    await load()
  } catch (error) {
    props.app.toast(error.message)
  }
}

onMounted(load)

watch(
  () => [props.app.view, props.app.meta.plategaMerchantId, props.app.meta.plategaSecret],
  ([view]) => {
    if (view === 'income') load()
  }
)
</script>
