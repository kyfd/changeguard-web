<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue?: string | number
    options?: { label: string; value: string | number; disabled?: boolean }[]
    size?: 'sm' | 'md' | 'lg'
    disabled?: boolean
    placeholder?: string
  }>(),
  {
    modelValue: '',
    options: () => [],
    size: 'md',
    disabled: false,
    placeholder: '请选择',
  }
)

const emit = defineEmits<{
  'update:modelValue': [val: string | number]
  change: [val: string | number]
}>()

function onChange(e: Event) {
  const val = (e.target as HTMLSelectElement).value
  emit('update:modelValue', val)
  emit('change', val)
}
</script>

<template>
  <div class="ui-select-box" :class="[`size-${size}`, { 'is-disabled': disabled }]">
    <select
      :value="modelValue"
      :disabled="disabled"
      class="ui-select-native"
      @change="onChange"
    >
      <option v-if="placeholder && !modelValue" value="" disabled selected>
        {{ placeholder }}
      </option>
      <option
        v-for="opt in options"
        :key="String(opt.value)"
        :value="opt.value"
        :disabled="opt.disabled"
      >
        {{ opt.label }}
      </option>
    </select>
    <span class="chevron-icon" aria-hidden="true">&#9662;</span>
  </div>
</template>

<style scoped>
.ui-select-box {
  display: inline-flex;
  align-items: center;
  position: relative;
  width: 100%;
  border-radius: var(--r);
  background: var(--surface);
  border: 1px solid var(--line-strong);
  transition: border-color var(--dur-fast), box-shadow var(--dur-fast);
}

.ui-select-box:hover:not(.is-disabled) {
  border-color: var(--brand);
}

.ui-select-box:focus-within:not(.is-disabled) {
  border-color: var(--brand);
  box-shadow: 0 0 0 2px var(--brand-soft);
}

.ui-select-native {
  width: 100%;
  height: 100%;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-strong);
  font-family: inherit;
  font-size: var(--fs-13);
  padding: 0 var(--sp-6) 0 var(--sp-3);
  appearance: none;
  cursor: pointer;
}

.chevron-icon {
  position: absolute;
  right: var(--sp-3);
  pointer-events: none;
  font-size: 10px;
  color: var(--text-faint);
}

.size-sm {
  height: 28px;
}
.size-sm .ui-select-native {
  font-size: var(--fs-12);
  padding-left: var(--sp-2);
}

.size-md {
  height: 32px;
}
.size-md .ui-select-native {
  font-size: var(--fs-13);
}

.size-lg {
  height: 40px;
}
.size-lg .ui-select-native {
  font-size: var(--fs-14);
}

.is-disabled {
  opacity: 0.6;
  background: var(--surface-2);
  cursor: not-allowed;
}
</style>
