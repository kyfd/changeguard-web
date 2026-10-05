<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkspaceStore } from '@/stores/workspace.ts'
import {
  buildPanorama,
  stageOf,
  type StageId,
} from '@/lib/panorama.ts'
import TechIcon from '@/components/TechIcon.vue'

import PanoramaTelemetry from './panorama/components/PanoramaTelemetry.vue'
import PanoramaRiskPanel from './panorama/components/PanoramaRiskPanel.vue'
import PanoramaServiceBoard from './panorama/components/PanoramaServiceBoard.vue'
import PanoramaStateMap from './panorama/components/PanoramaStateMap.vue'
import PanoramaStageResults from './panorama/components/PanoramaStageResults.vue'
import PanoramaRulesPanel from './panorama/components/PanoramaRulesPanel.vue'
import PanoramaSourceCard from './panorama/components/PanoramaSourceCard.vue'
import './panorama/panorama.css'

const ws = useWorkspaceStore()
const router = useRouter()
const selected = ref<StageId | 'all'>('all')

const model = computed(() => buildPanorama(ws.changes, ws.apps))
const available = computed(() => Boolean(ws.data))

const sourceMissing = (source: string) =>
  Boolean(ws.data?.unavailableSources?.includes(source))

const missingLabels: Record<string, string> = {
  apps: '服务',
  policies: '规则',
  audits: '审计',
  dashboard: '统计',
  users: '成员',
  config: '配置',
  conflicts: '冲突',
  integrationStatus: '集成状态',
  integrationEvents: '集成事件',
}

const partial = computed(() =>
  (ws.data?.unavailableSources || [])
    .map((source) => missingLabels[source] || source)
    .join('、')
)

const snapshotTime = computed(() =>
  ws.loadedAt
    ? new Intl.DateTimeFormat('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(ws.loadedAt)
    : '尚未读取'
)

const selectedStage = computed(() =>
  model.value.stages.find((stage) => stage.id === selected.value)
)

const selectedChanges = computed(() =>
  model.value.recent.filter(
    (change) =>
      selected.value === 'all' || stageOf(change.status) === selected.value
  )
)

const visibleChanges = computed(() => selectedChanges.value.slice(0, 6))

const currentTone = computed(() =>
  ws.error ? 'red' : ws.loading || partial.value ? 'amber' : 'cyan'
)

const currentStatus = computed(() =>
  ws.loading
    ? '读取中'
    : ws.error
      ? '读取失败'
      : partial.value
        ? '部分数据缺失'
        : available.value
          ? '快照已读取'
          : '等待数据'
)

const metrics = computed(() => [
  {
    key: 'total',
    label: '已加载变更',
    value: model.value.total,
    code: 'CHANGES',
    tone: 'cyan',
  },
  {
    key: 'pending',
    label: '等待审批',
    value: model.value.pending,
    code: 'AWAITING REVIEW',
    tone: 'amber',
  },
  {
    key: 'failed',
    label: '检查未通过',
    value: model.value.failed,
    code: 'CHECK FAILED',
    tone: 'red',
  },
  {
    key: 'high',
    label: '高危变更',
    value: model.value.high,
    code: 'HIGH RISK',
    tone: 'red',
  },
  {
    key: 'consumed',
    label: '通行证已消费',
    value: model.value.consumed,
    code: 'CONSUMED',
    tone: 'cyan',
  },
])

async function refresh() {
  try {
    await ws.load(true)
  } catch {
    /* 工作区状态展示错误，保留上次快照。 */
  }
}

function selectStage(id: StageId | 'all') {
  selected.value = id
}

function go(name: string) {
  void router.push({ name })
}

function openChange(id: string) {
  void router.push({ name: 'change-detail', params: { id } })
}
</script>

<template>
  <section class="panorama-room" :aria-busy="ws.loading">
    <!-- 控制室顶栏 -->
    <header class="room-header">
      <div class="identity">
        <div class="brand-symbol" aria-hidden="true">
          <TechIcon name="shield" :size="24" />
        </div>
        <div>
          <span class="product-name">ChangeGuard <span>/ CONTROL ROOM</span></span>
          <h1>变更全景</h1>
        </div>
      </div>
      <div class="header-actions">
        <div class="snapshot" role="status">
          <span class="signal" :class="currentTone"></span>
          <span>{{ currentStatus }}<small>快照时间 {{ snapshotTime }}</small></span>
        </div>
        <button
          class="control"
          type="button"
          :disabled="ws.loading"
          @click="refresh"
        >
          <TechIcon name="refresh" :size="15" />
          <span>{{ ws.loading ? '读取中…' : '刷新数据' }}</span>
        </button>
        <button class="control exit" type="button" @click="go('dashboard')">
          <TechIcon name="arrow" :size="15" />工作台
        </button>
      </div>
    </header>

    <!-- 告警与通知提示 -->
    <div v-if="ws.error" class="notice error" role="alert">
      <TechIcon name="shield-alert" :size="18" />
      <span>{{ ws.error }}。{{
        available
          ? '下方保留上一次成功读取的快照，请刷新重试。'
          : '尚无可用快照，请刷新重试。'
      }}</span>
    </div>
    <div v-else-if="partial" class="notice" role="status">
      部分数据源未能读取：{{ partial }}。其余内容仍来自本次快照。
    </div>
    <div v-else-if="ws.loading && !available" class="notice" role="status">
      正在读取工作区数据，尚未生成快照。
    </div>

    <!-- 关键指标遥测卡 -->
    <PanoramaTelemetry
      :metrics="metrics"
      :total="model.total"
      :available="available"
    />

    <!-- 控制室主网格 -->
    <div class="room-grid">
      <!-- 左栏：风险分布与受影响服务 -->
      <aside class="left-rail">
        <PanoramaRiskPanel
          :high="model.high"
          :risk-rows="model.riskRows"
          :total="model.total"
          :available="available"
          @navigate="go"
        />
        <PanoramaServiceBoard
          :services="model.services"
          :available="available"
          :missing="sourceMissing('apps')"
          @navigate="go"
        />
      </aside>

      <!-- 中栏：状态电路图与阶段结果 -->
      <div class="center-column">
        <PanoramaStateMap
          :stages="model.stages"
          :selected="selected"
          :available="available"
          @select-stage="selectStage"
        />
        <PanoramaStageResults
          :selected-stage="selectedStage"
          :selected-changes="selectedChanges"
          :visible-changes="visibleChanges"
          :available="available"
          :selected="selected"
          :total="model.total"
          @select-stage="selectStage"
          @navigate="go"
          @open-change="openChange"
        />
      </div>

      <!-- 右栏：高频命中规则与数据源追踪 -->
      <aside class="right-rail">
        <PanoramaRulesPanel
          :rules="model.rules"
          :available="available"
          @navigate="go"
        />
        <PanoramaSourceCard
          :total="model.total"
          :available="available"
          :policies-count="ws.policies.length"
          :audits-count="ws.audits.length"
          :policies-missing="sourceMissing('policies')"
          :audits-missing="sourceMissing('audits')"
          @navigate="go"
        />
      </aside>
    </div>

    <!-- 控制室底栏 -->
    <footer class="room-footer">
      <span><span class="signal cyan"></span>CHANGEGUARD / 变更检查与审批</span>
      <span>按需刷新 · 当前已加载范围 · 不展示实时拓扑</span>
    </footer>
  </section>
</template>
