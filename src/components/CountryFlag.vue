<template>
  <span class="country-flag" :title="code ? code : ''">
    <img v-if="flagUrl" :src="flagUrl" :alt="code" class="flag-img" loading="lazy" decoding="async" referrerpolicy="no-referrer" @error="onError">
    <span v-else class="flag-fallback">{{ emojiFlag }}</span>
  </span>
</template>

<script>
export default {
  props: {
    code: { type: String, default: "" }
  },
  data() {
    return { failed: false };
  },
  computed: {
    normalized() {
      return String(this.code || "").trim().toUpperCase();
    },
    flagUrl() {
      if (this.failed) return "";
      if (!/^[A-Z]{2}$/.test(this.normalized)) return "";
      return `https://flagcdn.com/${this.normalized.toLowerCase()}.svg`;
    },
    emojiFlag() {
      if (!/^[A-Z]{2}$/.test(this.normalized)) return "🌐";
      return [...this.normalized].map((char) => String.fromCodePoint(127397 + char.charCodeAt(0))).join("");
    }
  },
  watch: {
    code() {
      this.failed = false;
    }
  },
  methods: {
    onError() {
      this.failed = true;
    }
  }
};
</script>

<style scoped>
.country-flag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.2em;
  height: 1.2em;
  vertical-align: middle;
  line-height: 1;
}
.flag-img {
  width: 1.4em;
  height: 1em;
  object-fit: cover;
  border-radius: 2px;
  display: block;
}
.flag-fallback {
  font-size: 1.1em;
}
</style>
