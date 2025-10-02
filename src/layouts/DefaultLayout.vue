<template>
  <div class="default-layout d-flex flex-column min-vh-100">
    <slot name="header" />
    <main class="flex-fill">
      <slot />
    </main>
    <slot name="footer" />
  </div>
</template>

<style scoped>
.default-layout {
  background-color: #f8f9fa;
}
</style>
