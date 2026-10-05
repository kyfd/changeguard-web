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
        <span class="label-text">{{ metric.label }}</span>
        <span class="metric-ping" :class="metric.tone" aria-hidden="true"></span>
      </div>
      <div class="metric-value">
        <span class="num">{{ count(metric.value, available) }}</span>
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

<style scoped>
.metric {
  position: relative;
  padding: 22px 28px;
  border-left: 1px solid var(--p-line);
  transition: all 0.2s ease;
}
.metric:first-child {
  border-left: none;
}
.metric:hover {
  background: rgba(56, 189, 248, 0.04);
}

.metric-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.label-text {
  font-size: var(--fs-13);
  color: var(--p-muted);
  font-weight: var(--fw-medium);
}

.metric-ping {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  position: relative;
}
.metric-ping.cyan {
  background: var(--p-cyan);
  box-shadow: 0 0 8px var(--p-cyan);
}
.metric-ping.amber {
  background: var(--p-amber);
  box-shadow: 0 0 8px var(--p-amber);
}
.metric-ping.red {
  background: var(--p-red);
  box-shadow: 0 0 8px var(--p-red);
}

.metric-value {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 6px;
}
.num {
  font-size: 32px;
  font-weight: var(--fw-bold);
  font-family: var(--font-sans);
  letter-spacing: -0.03em;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  color: var(--p-text);
}
.metric.cyan .num {
  color: var(--p-cyan);
  text-shadow: 0 0 16px rgba(56, 189, 248, 0.3);
}
.metric.amber .num {
  color: var(--p-amber);
  text-shadow: 0 0 16px rgba(251, 191, 36, 0.3);
}
.metric.red .num {
  color: var(--p-red);
  text-shadow: 0 0 16px rgba(248, 113, 113, 0.3);
}

.metric-value small {
  font-size: var(--fs-12);
  color: var(--p-muted);
}

.metric-code {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  color: var(--p-muted);
  text-transform: uppercase;
}
</style>
