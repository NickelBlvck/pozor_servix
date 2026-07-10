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

    <div v-if="!loading && !platega.value.balances.length && !incomes.length" class="inline-empty income-empty-state">
      <div><strong>{{ app.t('income.emptyStateTitle') }}</strong></div>
      <div>{{ app.t('income.emptyStateText') }}</div>
    </div>

    <article class="chart-panel income-balance-panel">
      <div class="chart-title-row">
        <h2>{{ app.t('income.plategaBalances') }}</h2>
        <span>{{ app.t('income.plategaBalancesHelp') }}</span>
      </div>
      <div v-if="platega.value.balances.length" class="balance-list">
        <div v-for="balance in platega.value.balances" :key="balance.currency" class="balance-row">
          <span><strong>{{ balance.currency }}</strong></span>
          <span>{{ formatMoney(balance.amount, balance.currency) }}</span>
          <small v-if="balance.frozenBalance > 0">{{ app.t('income.frozenBalance', { amount: formatMoney(balance.frozenBalance, balance.currency) }) }}</small>
        </div>
      </div>
      <div v-else class="inline-empty">
        <div>{{ platega.value.error || app.t('income.plategaEmpty') }}</div>
        <div class="income-hint">{{ app.t('income.plategaHint') }}</div>
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
const loading = ref(false)
const platega = ref({ configured: false, balances: [], error: '' })
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
    const [summary, list] = await Promise.all([summaryPromise, listPromise])
    if (summary.error) props.app.toast(summary.error)
    if (list.error) props.app.toast(list.error)
    platega.value = summary.platega || platega.value
    incomes.value = summary.error ? list.items || [] : (Array.isArray(summary.incomes) ? summary.incomes : list.items || [])
    authors.value = list.authors || []
  } catch (error) {
    props.app.toast(error.message)
  } finally {
    loading.value = false
  }
}

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
