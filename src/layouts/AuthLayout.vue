<template>
  <div class="auth-layout d-flex flex-column min-vh-100">
    <main class="flex-fill d-flex align-items-center justify-content-center">
      <div class="w-100">
        <slot />
      </div>
    </main>

    <footer class="bg-light py-3 mt-auto border-top">
      <div class="container text-center text-muted small">© {{ new Date().getFullYear() }} Manga Flow Manager</div>
    </footer>
  </div>
</template>

<style scoped>
.auth-layout {
  background: linear-gradient(135deg, rgba(0, 123, 255, 0.12), rgba(255, 255, 255, 0.9));
}
</style>
