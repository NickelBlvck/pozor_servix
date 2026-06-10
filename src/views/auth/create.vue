<template>
  <div class="login-screen">
    <form class="login-card" @submit.prevent="app.submitAuth">
      <div class="brand compact">
        <div class="brand-mark">{{ app.t("logo.brand") }}</div>
        <div>
          <strong>{{ app.meta.siteTitle }}</strong>
          <span>{{ app.t("auth.createUser") }}</span>
        </div>
      </div>
      <label>{{ app.t("auth.login") }}<input v-model="app.auth.login" type="text" autocomplete="username" required autofocus></label>
      <label>{{ app.t("auth.password") }}<input v-model="app.auth.password" type="password" autocomplete="new-password" required></label>
      <label>{{ app.t("auth.passwordRepeat") }}<input v-model="app.auth.passwordRepeat" type="password" autocomplete="new-password" required></label>
      <p v-if="app.authError" class="form-error">{{ app.authError }}</p>
      <button class="primary-button" type="submit">{{ app.t("auth.createUser") }}</button>
    </form>
  </div>
</template>

<script>
export default {
  props: {
    app: { type: Object, required: true }
  }
};
</script>
