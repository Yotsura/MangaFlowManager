<script setup lang="ts">
interface Props {
  isEditMode: boolean;
  canSave: boolean;
  isSaving: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  'toggle-edit-mode': [];
  'cancel': [];
  'save': [];
}>();
</script>

<template>
  <div class="work-action-buttons">
    <!-- 編集モードでない時：編集ボタンのみ -->
    <button
      v-if="!isEditMode"
      type="button"
      class="btn btn-primary rounded-circle shadow"
      @click="emit('toggle-edit-mode')"
      title="編集モードに切り替え"
    >
      <i class="bi bi-pencil"></i>
    </button>

    <!-- 編集モード時：保存とキャンセル -->
    <template v-else>
      <button
        type="button"
        class="btn btn-secondary rounded-circle shadow"
        @click="emit('cancel')"
        :disabled="isSaving"
        title="変更をキャンセル"
      >
        <i class="bi bi-x-lg"></i>
      </button>
      <button
        type="button"
        class="btn btn-success rounded-circle shadow"
        @click="emit('save')"
        :disabled="!canSave || isSaving"
        title="変更を保存"
      >
        <i class="bi bi-check-lg" v-if="!isSaving"></i>
        <span class="spinner-border spinner-border-sm" v-else></span>
      </button>
    </template>
  </div>
</template>

<style scoped>
.work-action-buttons {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  z-index: 1000;
}

.work-action-buttons .btn {
  width: 3.5rem;
  height: 3.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  padding: 0;
}

.work-action-buttons .btn i {
  margin: 0;
}

@media (max-width: 768px) {
  .work-action-buttons {
    bottom: 1rem;
    right: 1rem;
  }

  .work-action-buttons .btn {
    width: 3rem;
    height: 3rem;
    font-size: 1.1rem;
  }
}
</style>
