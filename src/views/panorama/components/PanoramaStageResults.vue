<script setup lang="ts">
import TechIcon from '@/components/TechIcon.vue'
import { STATUS_LABEL, RISK_LABEL, fmtTime } from '@/lib/labels.ts'
import { changeTime, type StageId } from '@/lib/panorama.ts'

defineProps<{
  selectedStage?: { label: string }
  selectedChanges: any[]
  visibleChanges: any[]
  available: boolean
  selected: StageId | 'all'
  total: number
}>()

const emit = defineEmits<{
  selectStage: [id: StageId | 'all']
  navigate: [target: string]
  openChange: [id: string]
}>()

function count(val: number, available: boolean) {
  return available ? val.toLocaleString('zh-CN') : '—'
}
</script>

<template>
  <section
    class="instrument changes-panel"
    data-testid="stage-results"
    aria-labelledby="selection-title"
  >
    <header class="panel-heading">
      <div>
        <h2 id="selection-title">
          {{ selectedStage?.label || '最近变更' }}
          <span class="result-count">{{ count(selectedChanges.length, available) }}</span>
        </h2>
        <p>点选上方阶段，查看对应记录</p>
      </div>
      <button
        class="text-control"
        type="button"
        :aria-pressed="selected === 'all'"
        @click="emit('selectStage', 'all')"
      >
        全部阶段
      </button>
    </header>

    <div v-if="available && visibleChanges.length" class="change-list">
      <button
        v-for="change in visibleChanges"
        :key="change.id"
        type="button"
        class="change-row"
        :data-change-id="change.id"
        @click="emit('openChange', change.id)"
      >
        <span
          class="change-mark"
          :class="
            change.risk === 'HIGH'
              ? 'red'
              : change.risk === 'MEDIUM'
                ? 'amber'
                : 'cyan'
          "
          aria-hidden="true"
        ></span>
        <span class="change-info">
          <span class="change-title" :title="change.title || change.id">
            {{ change.title || change.id }}
          </span>
          <span class="change-meta">
            <span>{{ change.id }}</span>
            <span>{{
              changeTime(change)
                ? fmtTime(new Date(changeTime(change)).toISOString())
                : '—'
            }}</span>
          </span>
        </span>
        <span class="change-state">
          {{ STATUS_LABEL[change.status] || change.status }}
          <small>{{ RISK_LABEL[change.risk] || '未评级' }}</small>
        </span>
        <span class="row-arrow" aria-hidden="true">↗</span>
      </button>
    </div>

    <div v-else class="empty-state list-empty">
      <TechIcon name="code" :size="24" />
      <strong>{{
        !available
          ? '等待工作区快照'
          : total
            ? '这个阶段暂无变更'
            : '当前没有变更记录'
      }}</strong>
      <span>{{
        !available
          ? '数据读取后在这里展示对应变更。'
          : '选择其他阶段，或前往变更列表。'
      }}</span>
    </div>

    <footer class="list-foot">
      <span>按更新时间排序 · 最多显示 6 笔</span>
      <button class="text-control" type="button" @click="emit('navigate', 'changes')">
        变更列表 ↗
      </button>
    </footer>
  </section>
</template>
