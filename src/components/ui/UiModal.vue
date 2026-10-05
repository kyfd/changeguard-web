<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    width?: string
    closeOnEsc?: boolean
    showClose?: boolean
  }>(),
  {
    title: '',
    width: '520px',
    closeOnEsc: true,
    showClose: true,
  }
)

const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  close: []
}>()

function onClose() {
  emit('update:modelValue', false)
  emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (props.closeOnEsc && e.key === 'Escape' && props.modelValue) {
    onClose()
  }
}

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  }
)

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="ui-modal-fade">
      <div v-if="modelValue" class="ui-modal-overlay" @click.self="onClose">
        <div class="ui-modal-card" :style="{ maxWidth: width }" role="dialog" aria-modal="true">
          <header v-if="title || $slots.header" class="ui-modal-head">
            <slot name="header">
              <h3 class="ui-modal-title">{{ title }}</h3>
            </slot>
            <button v-if="showClose" class="ui-modal-close" type="button" @click="onClose">
              &times;
            </button>
          </header>

          <main class="ui-modal-body">
            <slot />
          </main>

          <footer v-if="$slots.footer" class="ui-modal-foot">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ui-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--sp-4);
  background: rgba(12, 15, 24, 0.58);
  backdrop-filter: blur(6px);
}

.ui-modal-card {
  width: 100%;
  border-radius: var(--r-xl);
  background: var(--surface);
  border: 1px solid var(--line-strong);
  box-shadow: var(--shadow-pop);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: modal-pop 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.ui-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-4) var(--sp-5);
  border-bottom: 1px solid var(--line);
}

.ui-modal-title {
  margin: 0;
  font-size: var(--fs-16);
  font-weight: var(--fw-semibold);
  color: var(--text-strong);
}

.ui-modal-close {
  background: transparent;
  border: none;
  font-size: 20px;
  line-height: 1;
  color: var(--text-mute);
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: color var(--dur-fast);
}

.ui-modal-close:hover {
  color: var(--text-strong);
}

.ui-modal-body {
  padding: var(--sp-5);
  overflow-y: auto;
  max-height: calc(85vh - 120px);
}

.ui-modal-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-5);
  border-top: 1px solid var(--line);
  background: var(--surface-2);
}

.ui-modal-fade-enter-active,
.ui-modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.ui-modal-fade-enter-from,
.ui-modal-fade-leave-to {
  opacity: 0;
}

@keyframes modal-pop {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(6px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
</style>
