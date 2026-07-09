<template>
  <img v-if="src" class="favicon" :src="src" alt="" referrerpolicy="no-referrer" @error="onError">
  <span v-else class="favicon-placeholder" :class="placeholderClass">{{ initial }}</span>
</template>

<script>
export default {
  props: {
    url: { type: String, default: "" },
    initial: { type: String, default: "?" },
    placeholderClass: { type: String, default: "" }
  },
  data() {
    return { stage: 0 };
  },
  computed: {
    src() {
      const url = String(this.url || "").trim();
      if (!url || this.stage >= 2) return "";
      if (this.stage === 1) {
        try {
          return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`;
        } catch {
          return "";
        }
      }
      return url;
    }
  },
  watch: {
    url() {
      this.stage = 0;
    }
  },
  methods: {
    onError() {
      this.stage = this.stage === 0 ? 1 : 2;
    }
  }
};
</script>
