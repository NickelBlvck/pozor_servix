<template>
  <section class="view active">
    <div class="section-head">
      <h1>{{ app.t("nav.providers") }}</h1>
      <button class="primary-button" type="button" @click="app.openProvider()"><PlusIcon :size="18" />{{ app.t("providers.add") }}</button>
    </div>
    <div class="provider-grid" v-if="app.providers.length">
      <article v-for="provider in app.providers" :key="provider.id" class="provider-card" :style="app.providerStyle(provider)">
        <header>
          <div class="card-title-row">
            <ProviderFavicon :url="provider.faviconUrl" :initial="provider.name.slice(0, 1).toUpperCase()" placeholder-class="provider-color-mark" />
            <div>
              <h2>{{ provider.name }}</h2>
              <span>{{ provider.loginUrl || app.t("providers.loginUrlEmpty") }}</span>
            </div>
          </div>
        </header>
        <p v-if="provider.note" class="provider-note">{{ provider.note }}</p>
        <footer>
          <a v-if="provider.loginUrl" class="secondary-link icon-only tooltip" :href="provider.loginUrl" target="_blank" rel="noreferrer" :aria-label="app.t('common.login')" :data-tooltip="app.t('common.login')"><ExternalLinkIcon :size="16" /></a>
          <span v-else></span>
          <button class="secondary-button icon-only tooltip" type="button" @click="app.openProvider(provider)" :aria-label="app.t('common.open')" :data-tooltip="app.t('common.open')"><PencilIcon :size="16" /></button>
        </footer>
      </article>
    </div>
    <div v-else class="empty-state visible">
      <h1>{{ app.t("providers.emptyTitle") }}</h1>
      <p>{{ app.t("providers.emptyText") }}</p>
    </div>
  </section>
</template>

<script>
import { ExternalLink as ExternalLinkIcon, Pencil as PencilIcon, Plus as PlusIcon } from "@lucide/vue";

import ProviderFavicon from "../components/ProviderFavicon.vue";

export default {
  components: { ExternalLinkIcon, PencilIcon, PlusIcon, ProviderFavicon },
  props: {
    app: { type: Object, required: true }
  }
};
</script>
