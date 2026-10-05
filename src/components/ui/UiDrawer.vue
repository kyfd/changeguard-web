<script setup lang="ts">
import { watch, onMounted, onUnmounted } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    width?: string
    showClose?: boolean
    closeOnEsc?: boolean
  }>(),
  {
    title: '',
    width: '460px',
    showClose: true,
    closeOnEsc: true,
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
    if (val) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
  }
)

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="ui-drawer-fade">
      <div v-if="modelValue" class="ui-drawer-overlay" @click.self="onClose">
        <aside class="ui-drawer-panel" :style="{ width }">
          <header class="ui-drawer-head">
            <slot name="header">
              <h3 class="ui-drawer-title">{{ title }}</h3>
            </slot>
            <button v-if="showClose" class="ui-drawer-close" type="button" @click="onClose">
              &times;
            </button>
          </header>

          <main class="ui-drawer-body">
            <slot />
          </main>

          <footer v-if="$slots.footer" class="ui-drawer-foot">
            <slot name="footer" />
          </footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ui-drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(12, 15, 24, 0.45);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: flex-end;
}

.ui-drawer-panel {
  height: 100%;
  max-width: 90vw;
  background: var(--surface);
  border-left: 1px solid var(--line-strong);
  box-shadow: var(--shadow-pop);
  display: flex;
  flex-direction: column;
  animation: drawer-slide 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}

.ui-drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-4) var(--sp-5);
  border-bottom: 1px solid var(--line);
  background: var(--surface);
}

.ui-drawer-title {
  margin: 0;
  font-size: var(--fs-16);
  font-weight: var(--fw-semibold);
  color: var(--text-strong);
}

.ui-drawer-close {
  background: transparent;
  border: none;
  font-size: 20px;
  line-height: 1;
  color: var(--text-mute);
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
}

.ui-drawer-close:hover {
  color: var(--text-strong);
}

.ui-drawer-body {
  flex: 1;
  padding: var(--sp-5);
  overflow-y: auto;
}

.ui-drawer-foot {
  padding: var(--sp-3) var(--sp-5);
  border-top: 1px solid var(--line);
  background: var(--surface-2);
}

.ui-drawer-fade-enter-active,
.ui-drawer-fade-leave-active {
  transition: opacity 0.22s ease;
}

.ui-drawer-fade-enter-from,
.ui-drawer-fade-leave-to {
  opacity: 0;
}

@keyframes drawer-slide {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}
</style>
