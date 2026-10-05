<script setup lang="ts">
import { computed } from 'vue'
import TechIcon from '@/components/TechIcon.vue'

const props = withDefaults(
  defineProps<{
    modelValue?: string | number
    placeholder?: string
    type?: string
    size?: 'sm' | 'md' | 'lg'
    disabled?: boolean
    readonly?: boolean
    prefixIcon?: string
    clearable?: boolean
    error?: string | boolean
    mono?: boolean
  }>(),
  {
    modelValue: '',
    type: 'text',
    size: 'md',
    disabled: false,
    readonly: false,
    clearable: false,
    error: false,
    mono: false,
  }
)

const emit = defineEmits<{
  'update:modelValue': [val: string]
  clear: []
  focus: [e: FocusEvent]
  blur: [e: FocusEvent]
}>()

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}

function onClear() {
  emit('update:modelValue', '')
  emit('clear')
}

const hasValue = computed(() => props.modelValue !== '' && props.modelValue != null)
</script>

<template>
  <div
    class="ui-input-box"
    :class="[
      `size-${size}`,
      {
        'is-disabled': disabled,
        'has-error': Boolean(error),
        'is-mono': mono,
      },
    ]"
  >
    <span v-if="prefixIcon" class="prefix-slot">
      <TechIcon :name="prefixIcon" :size="size === 'sm' ? 13 : 15" />
    </span>
    <input
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      class="ui-input-native"
      @input="onInput"
      @focus="emit('focus', $event)"
      @blur="emit('blur', $event)"
    />
    <button
      v-if="clearable && hasValue && !disabled && !readonly"
      class="clear-btn"
      type="button"
      @click="onClear"
    >
      &times;
    </button>
  </div>
</template>

<style scoped>
.ui-input-box {
  display: inline-flex;
  align-items: center;
  position: relative;
  width: 100%;
  border-radius: var(--r);
  background: var(--surface);
  border: 1px solid var(--line-strong);
  transition: border-color var(--dur-fast), box-shadow var(--dur-fast), background var(--dur-fast);
}

.ui-input-box:hover:not(.is-disabled) {
  border-color: var(--brand);
}

.ui-input-box:focus-within:not(.is-disabled) {
  border-color: var(--brand);
  box-shadow: 0 0 0 2px var(--brand-soft);
}

.ui-input-native {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-strong);
  font-family: inherit;
  font-size: var(--fs-13);
  padding: 0 var(--sp-3);
  height: 100%;
}

.ui-input-native::placeholder {
  color: var(--text-faint);
}

.size-sm {
  height: 28px;
}
.size-sm .ui-input-native {
  font-size: var(--fs-12);
  padding: 0 var(--sp-2);
}

.size-md {
  height: 32px;
}
.size-md .ui-input-native {
  font-size: var(--fs-13);
  padding: 0 var(--sp-3);
}

.size-lg {
  height: 40px;
}
.size-lg .ui-input-native {
  font-size: var(--fs-14);
  padding: 0 var(--sp-4);
}

.prefix-slot {
  display: inline-flex;
  align-items: center;
  padding-left: var(--sp-3);
  color: var(--text-mute);
  flex-shrink: 0;
}

.clear-btn {
  background: transparent;
  border: none;
  color: var(--text-faint);
  cursor: pointer;
  padding: 0 var(--sp-2);
  font-size: 15px;
  line-height: 1;
  transition: color var(--dur-fast);
}

.clear-btn:hover {
  color: var(--text-strong);
}

.is-mono .ui-input-native {
  font-family: var(--font-mono);
}

.is-disabled {
  opacity: 0.6;
  background: var(--surface-2);
  cursor: not-allowed;
}

.has-error {
  border-color: var(--cinnabar) !important;
}

.has-error:focus-within {
  box-shadow: 0 0 0 2px var(--cinnabar-soft) !important;
}
</style>
