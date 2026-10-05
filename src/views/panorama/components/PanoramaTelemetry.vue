<script setup lang="ts">
defineProps<{
  metrics: {
    key: string
    label: string
    value: number
    code: string
    tone: string
  }[]
  total: number
  available: boolean
}>()

function count(val: number, available: boolean) {
  return available ? val.toLocaleString('zh-CN') : '—'
}
</script>

<template>
  <section class="telemetry" aria-label="当前快照指标">
    <div
      v-for="metric in metrics"
      :key="metric.key"
      class="metric"
      :class="metric.tone"
      :data-testid="'metric-' + metric.key"
    >
      <div class="metric-label">
        <span>{{ metric.label }}</span>
        <span class="metric-tick" aria-hidden="true">⌁</span>
      </div>
      <div class="metric-value">
        {{ count(metric.value, available) }}
        <small v-if="metric.key === 'consumed'">/ {{ count(total, available) }}</small>
        <small v-else>笔</small>
      </div>
      <span class="metric-code">
        {{ metric.code }}
        <span v-if="metric.key === 'consumed'"> · 已加载</span>
      </span>
    </div>
  </section>
</template>
