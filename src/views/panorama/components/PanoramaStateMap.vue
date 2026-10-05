<script setup lang="ts">
import type { StageId } from '@/lib/panorama.ts'

defineProps<{
  stages: {
    id: StageId
    label: string
    code: string
    caption: string
    count: number
  }[]
  selected: StageId | 'all'
  available: boolean
}>()

const emit = defineEmits<{
  selectStage: [id: StageId]
}>()

function count(val: number, available: boolean) {
  return available ? val.toLocaleString('zh-CN') : '—'
}
</script>

<template>
  <section class="instrument pipeline-panel" aria-label="变更阶段分布">
    <header class="panel-heading">
      <div>
        <h2>变更控制链路</h2>
        <p>从内容检查到通行证消费</p>
      </div>
      <span class="pipeline-tag">STATE MAP</span>
    </header>

    <div class="pipeline-diagram">
      <svg
        class="circuit"
        viewBox="0 0 900 360"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <marker
            id="pano-arrow"
            viewBox="0 0 10 10"
            refX="7"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>
        <path
          class="circuit-path"
          d="M 150 75 H 450 H 750 V 285 H 450 H 150"
        />
        <path
          class="circuit-arrow"
          d="M 290 75 h 34 M 590 75 h 34 M 750 164 v 28 M 610 285 h -34 M 310 285 h -34"
          marker-end="url(#pano-arrow)"
        />
        <path class="circuit-grid" d="M 0 180 H 900 M 450 0 V 360" />
      </svg>

      <div class="diagram-caption">
        <span class="signal cyan"></span>检查 → 验证 → 审批 → 消费
      </div>

      <button
        v-for="stage in stages.slice(0, 6)"
        :key="stage.id"
        class="stage-node"
        :class="[
          'node-' + stage.id,
          {
            selected: selected === stage.id,
            attention:
              ['check', 'approve'].includes(stage.id) && stage.count > 0,
          },
        ]"
        type="button"
        :data-stage="stage.id"
        :aria-pressed="selected === stage.id"
        @click="emit('selectStage', stage.id)"
      >
        <span class="node-code"
          >{{ stage.code }}<span aria-hidden="true">↗</span></span
        >
        <span class="node-main"
          ><strong>{{ count(stage.count, available) }}</strong
          ><span>{{ stage.label }}</span></span
        >
        <span class="node-caption">{{ stage.caption }}</span>
      </button>
    </div>

    <div class="branch-row">
      <span class="branch-marker" aria-hidden="true">└</span>
      <span>分支状态</span>
      <button
        v-for="stage in stages.slice(6)"
        :key="stage.id"
        type="button"
        :data-stage="stage.id"
        :aria-pressed="selected === stage.id"
        :class="{ selected: selected === stage.id }"
        @click="emit('selectStage', stage.id)"
      >
        {{ stage.label }}<strong>{{ count(stage.count, available) }}</strong>
      </button>
    </div>

    <div class="pipeline-foot">
      <span>数字为当前状态分布，连线仅表示流程顺序。</span>
      <span>非累计通过量</span>
    </div>
  </section>
</template>
