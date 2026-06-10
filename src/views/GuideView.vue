<template>
  <section class="view active">
    <div class="section-head">
      <div>
        <h1>{{ app.t("nav.guide") }}</h1>
        <span>{{ app.t("guide.subtitle") }}</span>
      </div>
    </div>

    <section class="guide-search-panel">
      <input v-model="app.guideSearch" type="search" :placeholder="app.t('guide.search')">
      <span>{{ app.t("guide.found", { count: app.filteredGuideSections.length }) }}</span>
    </section>

    <div class="guide-manual" v-if="app.filteredGuideSections.length">
      <article v-for="section in app.filteredGuideSections" :key="section.id" class="guide-manual-card">
        <div class="guide-manual-head">
          <span class="guide-section-icon" aria-hidden="true">
            <component :is="iconFor(section.id)" :size="22" />
          </span>
          <div>
            <h2>{{ section.title }}</h2>
            <p>{{ section.text }}</p>
          </div>
        </div>

        <ul v-if="section.items.length" class="guide-list">
          <li v-for="item in section.items" :key="item">{{ item }}</li>
        </ul>

        <div class="guide-advice-grid" v-if="section.do.length || section.dont.length">
          <div v-if="section.do.length" class="guide-advice is-good">
            <strong>{{ app.t("guide.goodTitle") }}</strong>
            <ul>
              <li v-for="item in section.do" :key="item">{{ item }}</li>
            </ul>
          </div>
          <div v-if="section.dont.length" class="guide-advice is-bad">
            <strong>{{ app.t("guide.badTitle") }}</strong>
            <ul>
              <li v-for="item in section.dont" :key="item">{{ item }}</li>
            </ul>
          </div>
        </div>
      </article>
    </div>

    <div v-else class="empty-state visible guide-empty">
      <h1>{{ app.t("guide.emptyTitle") }}</h1>
      <p>{{ app.t("guide.emptyText") }}</p>
    </div>
  </section>
</template>

<script>
import {
  Bell,
  BookOpen,
  ClipboardList,
  CreditCard,
  FileText,
  LineChart,
  Rocket,
  Server,
  ShieldCheck
} from "@lucide/vue";

const guideIcons = {
  start: Rocket,
  records: Server,
  providers: ClipboardList,
  payments: CreditCard,
  notifications: Bell,
  statistics: LineChart,
  security: ShieldCheck,
  logs: FileText,
  bestPractices: BookOpen
};

export default {
  props: {
    app: { type: Object, required: true }
  },
  methods: {
    iconFor(id) {
      return guideIcons[id] || BookOpen;
    }
  }
};
</script>
