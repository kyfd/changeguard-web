<script setup lang="ts">
import TechIcon from '@/components/TechIcon.vue'

defineProps<{
  total: number
  available: boolean
  policiesCount: number
  auditsCount: number
  policiesMissing: boolean
  auditsMissing: boolean
}>()

const emit = defineEmits<{
  navigate: [target: string]
}>()

function count(val: number, available: boolean) {
  return available ? val.toLocaleString('zh-CN') : '—'
}
</script>

<template>
  <section class="instrument evidence-panel">
    <header class="panel-heading">
      <h2>快照来源</h2>
      <span>04 / SOURCES</span>
    </header>

    <dl class="source-list">
      <div>
        <dt>变更列表</dt>
        <dd>{{ available ? count(total, available) + ' 笔' : '未读取' }}</dd>
      </div>
      <div>
        <dt>已返回规则</dt>
        <dd>{{ !available || policiesMissing ? '未能读取' : policiesCount + ' 条' }}</dd>
      </div>
      <div>
        <dt>已返回审计</dt>
        <dd>{{ !available || auditsMissing ? '未能读取' : auditsCount + ' 条' }}</dd>
      </div>
    </dl>

    <p class="panel-note">
      审计最多读取 250 条；快照时间为浏览器读取完成时间。此页不监测服务存活。
    </p>

    <button class="panel-link" type="button" @click="emit('navigate', 'audits')">
      查看审计日志<TechIcon name="arrow" :size="14" />
    </button>
  </section>

  <div class="boundary-note">
    <span class="boundary-icon" aria-hidden="true">i</span>
    <p>
      通行证消费不代表部署成功。<small>部署结果应在 CI / CD 平台确认。</small>
    </p>
  </div>
</template>
