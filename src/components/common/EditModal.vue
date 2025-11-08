<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  show: boolean;
  title: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  centered?: boolean;
  canSave?: boolean;
  isSaving?: boolean;
  saveButtonText?: string;
  cancelButtonText?: string;
  hideSaveButton?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  size: 'lg',
  centered: false,
  canSave: true,
  isSaving: false,
  saveButtonText: '保存',
  cancelButtonText: 'キャンセル',
  hideSaveButton: false,
});

const emit = defineEmits<{
  close: [];
  save: [];
}>();

const modalSizeClass = computed(() => {
  switch (props.size) {
    case 'sm': return 'modal-sm';
    case 'md': return '';
    case 'lg': return 'modal-lg';
    case 'xl': return 'modal-xl';
    default: return 'modal-lg';
  }
});

const modalDialogClass = computed(() => {
  const classes = ['modal-dialog'];
  if (props.centered) {
    classes.push('modal-dialog-centered');
  } else {
    classes.push('modal-dialog-scrollable');
  }
  return classes.join(' ');
});

const handleClose = () => {
  emit('close');
};

const handleSave = () => {
  emit('save');
};
</script>

<template>
  <Teleport to="body">
    <Transition name="backdrop-fade">
      <div v-if="show" class="modal-backdrop" @click="handleClose"></div>
    </Transition>
    <Transition name="modal-fade">
      <div v-if="show" class="modal d-block" tabindex="-1" @click.self="handleClose">
        <div :class="[modalDialogClass, modalSizeClass]">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">{{ title }}</h5>
              <button type="button" class="btn-close" :disabled="isSaving" @click="handleClose"></button>
            </div>
            <div class="modal-body">
              <slot></slot>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" :disabled="isSaving" @click="handleClose">
                <i class="bi bi-x me-1"></i>{{ cancelButtonText }}
              </button>
              <button
                v-if="!hideSaveButton"
                type="button"
                class="btn btn-primary"
                :disabled="!canSave || isSaving"
                @click="handleSave"
              >
                <span v-if="isSaving" class="spinner-border spinner-border-sm me-1"></span>
                <i v-else class="bi bi-check me-1"></i>
                {{ isSaving ? '保存中...' : saveButtonText }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal {
  z-index: 1055;
}

.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1050;
}

/* モーダルのフェードアニメーション */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.15s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-active .modal-dialog {
  transition: transform 0.3s ease-out;
}

.modal-fade-enter-from .modal-dialog {
  transform: translateY(-50px);
}

/* 背景のフェードアニメーション */
.backdrop-fade-enter-active,
.backdrop-fade-leave-active {
  transition: opacity 0.15s ease;
}

.backdrop-fade-enter-from,
.backdrop-fade-leave-to {
  opacity: 0;
}
</style>
