<script setup lang="ts">
import TechIcon from '@/components/TechIcon.vue'

defineProps<{
  high: number
  riskRows: { key: string; label: string; count: number; tone: string }[]
  total: number
  available: boolean
}>()

const emit = defineEmits<{
  navigate: [target: string]
}>()

function count(val: number, available: boolean) {
  return available ? val.toLocaleString('zh-CN') : '—'
}
</script>

<template>
  <section class="instrument risk-panel" data-testid="risk-panel">
    <header class="panel-heading">
      <h2>风险分布</h2>
      <span>01 / RISK</span>
    </header>

    <div class="risk-summary">
      <strong>{{ count(high, available) }}</strong>
      <div>高危变更<small>当前已加载范围</small></div>
      <TechIcon name="shield-alert" :size="30" />
    </div>

    <div class="risk-spectrum" aria-hidden="true">
      <i
        v-for="risk in riskRows"
        :key="risk.key"
        :class="risk.tone"
        :style="{ flex: risk.count }"
      ></i>
    </div>

    <ul class="risk-list">
      <li v-for="risk in riskRows" :key="risk.key">
        <span class="signal" :class="risk.tone"></span>
        <span>{{ risk.label }}</span>
        <strong>{{ count(risk.count, available) }}</strong>
        <small>{{
          available && total
            ? Math.round((risk.count / total) * 100) + '%'
            : '—'
        }}</small>
      </li>
    </ul>

    <p class="panel-note">风险等级来自变更记录，不表示系统健康状态。</p>

    <button class="panel-link" type="button" @click="emit('navigate', 'risks')">
      查看风险项<TechIcon name="arrow" :size="14" />
    </button>
  </section>
</template>
