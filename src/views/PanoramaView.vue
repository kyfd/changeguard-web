<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkspaceStore } from '@/stores/workspace'
import {
  buildPanorama,
  changeTime,
  stageOf,
  type StageId,
} from '@/lib/panorama'
import { STATUS_LABEL, RISK_LABEL, fmtTime } from '@/lib/labels'
import TechIcon from '@/components/TechIcon.vue'

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
    .join('、'),
)
const snapshotTime = computed(() =>
  ws.loadedAt
    ? new Intl.DateTimeFormat('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(ws.loadedAt)
    : '尚未读取',
)
const selectedStage = computed(() =>
  model.value.stages.find((stage) => stage.id === selected.value),
)
const selectedChanges = computed(() =>
  model.value.recent.filter(
    (change) =>
      selected.value === 'all' || stageOf(change.status) === selected.value,
  ),
)
const visibleChanges = computed(() => selectedChanges.value.slice(0, 6))
const serviceMax = computed(() =>
  Math.max(1, ...model.value.services.map((service) => service.count)),
)
const count = (value: number) =>
  available.value ? value.toLocaleString('zh-CN') : '—'
const currentTone = computed(() =>
  ws.error ? 'red' : ws.loading || partial.value ? 'amber' : 'cyan',
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
          : '等待数据',
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
</script>

<template>
  <section class="panorama-room" :aria-busy="ws.loading">
    <header class="room-header">
      <div class="identity">
        <div class="brand-symbol" aria-hidden="true">
          <TechIcon name="shield" :size="24" />
        </div>
        <div>
          <span class="product-name"
            >ChangeGuard <span>/ CONTROL ROOM</span></span
          >
          <h1>变更全景</h1>
        </div>
      </div>
      <div class="header-actions">
        <div class="snapshot" role="status">
          <span class="signal" :class="currentTone"></span
          ><span
            >{{ currentStatus }}<small>快照时间 {{ snapshotTime }}</small></span
          >
        </div>
        <button
          class="control"
          type="button"
          :disabled="ws.loading"
          @click="refresh"
        >
          <TechIcon name="refresh" :size="15" /><span>{{
            ws.loading ? '读取中…' : '刷新数据'
          }}</span>
        </button>
        <button class="control exit" type="button" @click="go('dashboard')">
          <TechIcon name="arrow" :size="15" />工作台
        </button>
      </div>
    </header>

    <div v-if="ws.error" class="notice error" role="alert">
      <TechIcon name="shield-alert" :size="18" /><span
        >{{ ws.error }}。{{
          available
            ? '下方保留上一次成功读取的快照，请刷新重试。'
            : '尚无可用快照，请刷新重试。'
        }}</span
      >
    </div>
    <div v-else-if="partial" class="notice" role="status">
      部分数据源未能读取：{{ partial }}。其余内容仍来自本次快照。
    </div>
    <div v-else-if="ws.loading && !available" class="notice" role="status">
      正在读取工作区数据，尚未生成快照。
    </div>

    <section class="telemetry" aria-label="当前快照指标">
      <div
        v-for="metric in metrics"
        :key="metric.key"
        class="metric"
        :class="metric.tone"
        :data-testid="'metric-' + metric.key"
      >
        <div class="metric-label">
          <span>{{ metric.label }}</span
          ><span class="metric-tick" aria-hidden="true">⌁</span>
        </div>
        <div class="metric-value">
          {{ count(metric.value)
          }}<small v-if="metric.key === 'consumed'"
            >/ {{ count(model.total) }}</small
          ><small v-else>笔</small>
        </div>
        <span class="metric-code"
          >{{ metric.code
          }}<span v-if="metric.key === 'consumed'"> · 已加载</span></span
        >
      </div>
    </section>

    <div class="room-grid">
      <aside class="left-rail">
        <section class="instrument risk-panel" data-testid="risk-panel">
          <header class="panel-heading">
            <h2>风险分布</h2>
            <span>01 / RISK</span>
          </header>
          <div class="risk-summary">
            <strong>{{ count(model.high) }}</strong>
            <div>高危变更<small>当前已加载范围</small></div>
            <TechIcon name="shield-alert" :size="30" />
          </div>
          <div class="risk-spectrum" aria-hidden="true">
            <i
              v-for="risk in model.riskRows"
              :key="risk.key"
              :class="risk.tone"
              :style="{ flex: risk.count }"
            ></i>
          </div>
          <ul class="risk-list">
            <li v-for="risk in model.riskRows" :key="risk.key">
              <span class="signal" :class="risk.tone"></span
              ><span>{{ risk.label }}</span
              ><strong>{{ count(risk.count) }}</strong
              ><small>{{
                available && model.total
                  ? Math.round((risk.count / model.total) * 100) + '%'
                  : '—'
              }}</small>
            </li>
          </ul>
          <p class="panel-note">风险等级来自变更记录，不表示系统健康状态。</p>
          <button class="panel-link" type="button" @click="go('risks')">
            查看风险项<TechIcon name="arrow" :size="14" />
          </button>
        </section>

        <section class="instrument service-panel" data-testid="services-panel">
          <header class="panel-heading">
            <h2>服务变更量</h2>
            <span>02 / SERVICES</span>
          </header>
          <p v-if="!available || sourceMissing('apps')" class="empty-state">
            服务信息未能读取，暂不展示排行。
          </p>
          <ol v-else-if="model.services.length" class="service-list">
            <li
              v-for="(service, index) in model.services.slice(0, 5)"
              :key="service.id"
            >
              <div>
                <span class="ordinal">{{
                  String(index + 1).padStart(2, '0')
                }}</span
                ><span class="service-name" :title="service.name">{{
                  service.name
                }}</span
                ><strong>{{ service.count }}</strong>
              </div>
              <div class="service-track" aria-hidden="true">
                <i
                  :style="{ width: (service.count / serviceMax) * 100 + '%' }"
                ></i>
              </div>
            </li>
          </ol>
          <p v-else class="empty-state">暂无服务变更记录。</p>
          <p class="panel-note">按当前变更归属统计 · 显示前 5 项</p>
          <button class="panel-link" type="button" @click="go('apps')">
            服务列表<TechIcon name="arrow" :size="14" />
          </button>
        </section>
      </aside>

      <div class="center-column">
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
              v-for="stage in model.stages.slice(0, 6)"
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
              @click="selectStage(stage.id)"
            >
              <span class="node-code"
                >{{ stage.code }}<span aria-hidden="true">↗</span></span
              ><span class="node-main"
                ><strong>{{ count(stage.count) }}</strong
                ><span>{{ stage.label }}</span></span
              ><span class="node-caption">{{ stage.caption }}</span>
            </button>
          </div>
          <div class="branch-row">
            <span class="branch-marker" aria-hidden="true">└</span
            ><span>分支状态</span
            ><button
              v-for="stage in model.stages.slice(6)"
              :key="stage.id"
              type="button"
              :data-stage="stage.id"
              :aria-pressed="selected === stage.id"
              :class="{ selected: selected === stage.id }"
              @click="selectStage(stage.id)"
            >
              {{ stage.label }}<strong>{{ count(stage.count) }}</strong>
            </button>
          </div>
          <div class="pipeline-foot">
            <span>数字为当前状态分布，连线仅表示流程顺序。</span
            ><span>非累计通过量</span>
          </div>
        </section>

        <section
          class="instrument changes-panel"
          data-testid="stage-results"
          aria-labelledby="selection-title"
        >
          <header class="panel-heading">
            <div>
              <h2 id="selection-title">
                {{ selectedStage?.label || '最近变更'
                }}<span class="result-count">{{
                  count(selectedChanges.length)
                }}</span>
              </h2>
              <p>点选上方阶段，查看对应记录</p>
            </div>
            <button
              class="text-control"
              type="button"
              :aria-pressed="selected === 'all'"
              @click="selectStage('all')"
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
              @click="
                router.push({
                  name: 'change-detail',
                  params: { id: change.id },
                })
              "
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
              ></span
              ><span class="change-info"
                ><span
                  class="change-title"
                  :title="change.title || change.id"
                  >{{ change.title || change.id }}</span
                ><span class="change-meta"
                  ><span>{{ change.id }}</span
                  ><span>{{
                    changeTime(change)
                      ? fmtTime(new Date(changeTime(change)).toISOString())
                      : '—'
                  }}</span></span
                ></span
              ><span class="change-state"
                >{{ STATUS_LABEL[change.status] || change.status
                }}<small>{{ RISK_LABEL[change.risk] || '未评级' }}</small></span
              ><span class="row-arrow" aria-hidden="true">↗</span>
            </button>
          </div>
          <div v-else class="empty-state list-empty">
            <TechIcon name="code" :size="24" /><strong>{{
              !available
                ? '等待工作区快照'
                : model.total
                  ? '这个阶段暂无变更'
                  : '当前没有变更记录'
            }}</strong
            ><span>{{
              !available
                ? '数据读取后在这里展示对应变更。'
                : '选择其他阶段，或前往变更列表。'
            }}</span>
          </div>
          <footer class="list-foot">
            <span>按更新时间排序 · 最多显示 6 笔</span
            ><button class="text-control" type="button" @click="go('changes')">
              变更列表 ↗
            </button>
          </footer>
        </section>
      </div>

      <aside class="right-rail">
        <section class="instrument rules-panel">
          <header class="panel-heading">
            <h2>高频命中规则</h2>
            <span>03 / FINDINGS</span>
          </header>
          <ol v-if="available && model.rules.length" class="rule-list">
            <li
              v-for="(rule, index) in model.rules.slice(0, 4)"
              :key="rule.code"
            >
              <button type="button" @click="go('risks')">
                <span class="rule-top"
                  ><span class="ordinal">{{
                    String(index + 1).padStart(2, '0')
                  }}</span
                  ><span>{{ rule.count }} 次命中</span></span
                ><strong :title="rule.title">{{ rule.title }}</strong
                ><small :title="rule.code">{{ rule.code }}</small>
              </button>
            </li>
          </ol>
          <p v-else class="empty-state">
            {{ available ? '当前变更暂无规则发现项。' : '等待变更数据读取。' }}
          </p>
          <p class="panel-note">
            统计当前变更的发现项，不代表仍在阻断；请查看具体检查结论。
          </p>
        </section>
        <section class="instrument evidence-panel">
          <header class="panel-heading">
            <h2>快照来源</h2>
            <span>04 / SOURCES</span>
          </header>
          <dl class="source-list">
            <div>
              <dt>变更列表</dt>
              <dd>{{ available ? count(model.total) + ' 笔' : '未读取' }}</dd>
            </div>
            <div>
              <dt>已返回规则</dt>
              <dd>
                {{
                  !available || sourceMissing('policies')
                    ? '未能读取'
                    : ws.policies.length + ' 条'
                }}
              </dd>
            </div>
            <div>
              <dt>已返回审计</dt>
              <dd>
                {{
                  !available || sourceMissing('audits')
                    ? '未能读取'
                    : ws.audits.length + ' 条'
                }}
              </dd>
            </div>
          </dl>
          <p class="panel-note">
            审计最多读取 250
            条；快照时间为浏览器读取完成时间。此页不监测服务存活。
          </p>
          <button class="panel-link" type="button" @click="go('audits')">
            查看审计日志<TechIcon name="arrow" :size="14" />
          </button>
        </section>
        <div class="boundary-note">
          <span class="boundary-icon" aria-hidden="true">i</span>
          <p>
            通行证消费不代表部署成功。<small
              >部署结果应在 CI / CD 平台确认。</small
            >
          </p>
        </div>
      </aside>
    </div>
    <footer class="room-footer">
      <span><span class="signal cyan"></span>CHANGEGUARD / 变更检查与审批</span
      ><span>按需刷新 · 当前已加载范围 · 不展示实时拓扑</span>
    </footer>
  </section>
</template>

<style scoped>
h1,
h2 {
  color: var(--p-text);
}
.panorama-room {
  --p-bg: #070f1b;
  --p-panel: #0c1929;
  --p-line: #22374c;
  --p-muted: #9bb0c4;
  --p-text: #e1edf6;
  --p-cyan: #6be4e8;
  --p-amber: #f1c178;
  --p-red: #ff8f92;
  flex: 0 0 auto;
  min-height: 100%;
  width: 100%;
  box-sizing: border-box;
  padding: 28px 32px 18px;
  color: var(--p-text);
  background:
    radial-gradient(ellipse at 50% 22%, #10273a70, transparent 55%), var(--p-bg);
  font-family: var(--font-sans);
  color-scheme: dark;
  position: relative;
  isolation: isolate;
}
.panorama-room::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background-image:
    linear-gradient(#7eafce05 1px, transparent 1px),
    linear-gradient(90deg, #7eafce05 1px, transparent 1px);
  background-size: 32px 32px;
}
button {
  font: inherit;
  cursor: pointer;
  color: inherit;
  background: transparent;
  border: 0;
}
button:focus-visible {
  outline: 2px solid var(--p-cyan);
  outline-offset: 4px;
}
button:disabled {
  cursor: wait;
  opacity: 0.6;
}
.room-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 28px;
}
.identity {
  display: flex;
  align-items: center;
  gap: 16px;
}
.brand-symbol {
  width: 48px;
  height: 48px;
  border: 1px solid #417887;
  color: var(--p-cyan);
  display: grid;
  place-items: center;
  position: relative;
  background: #0f2836;
  box-shadow: inset 0 0 20px #6be4e809;
}
.brand-symbol::after {
  content: '';
  position: absolute;
  inset: -5px;
  border: 1px solid #213e50;
  clip-path: polygon(
    0 0,
    24% 0,
    24% 2%,
    2% 2%,
    2% 24%,
    0 24%,
    0 0,
    100% 100%,
    76% 100%,
    76% 98%,
    98% 98%,
    98% 76%,
    100% 76%,
    100% 100%
  );
}
.product-name {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.product-name > span {
  font: 10px var(--font-mono);
  color: var(--p-muted);
  margin-left: 8px;
  letter-spacing: 0.1em;
}
h1 {
  font-size: 26px;
  letter-spacing: 0.12em;
  line-height: 1.3;
  margin: 5px 0 0;
  font-weight: 600;
}
.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}
.snapshot {
  display: flex;
  gap: 9px;
  align-items: flex-start;
  margin-right: 12px;
  font-size: 12px;
}
.snapshot > .signal {
  margin-top: 5px;
}
.snapshot small {
  display: block;
  color: var(--p-muted);
  font: 11px var(--font-mono);
  margin-top: 5px;
}
.control {
  border: 1px solid var(--p-line);
  padding: 0 15px;
  height: 40px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  background: #102235;
  border-radius: 3px;
  transition:
    border-color 0.15s,
    background 0.15s;
}
.control:hover {
  border-color: #54899a;
  background: #153247;
}
.exit {
  color: var(--p-cyan);
  border-color: #335966;
}
.signal {
  display: inline-block;
  width: 6px;
  height: 6px;
  flex: none;
  border-radius: 1px;
  background: currentColor;
}
.cyan {
  color: var(--p-cyan);
}
.amber {
  color: var(--p-amber);
}
.red {
  color: var(--p-red);
}
.muted {
  color: #8698ad;
}
.notice {
  padding: 12px 16px;
  border: 1px solid #725d39;
  background: #27251c;
  color: #f0d1a2;
  margin-bottom: 20px;
  font-size: 13px;
  line-height: 1.6;
  display: flex;
  align-items: center;
  gap: 10px;
}
.notice.error {
  border-color: #79474e;
  background: #2a1c27;
  color: #ffc0c3;
  overflow-wrap: anywhere;
}
.telemetry {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  border-block: 1px solid var(--p-line);
  margin-bottom: 24px;
  background: linear-gradient(90deg, #0f2133aa, #0c192980);
}
.metric {
  padding: 19px 24px;
  border-left: 1px solid var(--p-line);
  position: relative;
  min-width: 0;
}
.metric:first-child {
  border-left: 0;
}
.metric::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 24px;
  width: 22px;
  height: 2px;
  background: currentColor;
  opacity: 0.8;
}
.metric-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: var(--p-text);
}
.metric-tick {
  font: 20px var(--font-mono);
  color: #5b768d;
}
.metric-value {
  font: 500 42px/1.3 var(--font-mono);
  letter-spacing: -0.06em;
  margin-top: 5px;
  white-space: nowrap;
}
.metric-value small {
  font: 12px var(--font-mono);
  color: var(--p-muted);
  margin-left: 10px;
  letter-spacing: 0;
}
.metric-code {
  display: block;
  font: 9px var(--font-mono);
  letter-spacing: 0.12em;
  color: var(--p-muted);
  margin-top: 8px;
}
.room-grid {
  display: grid;
  grid-template-columns: minmax(210px, 0.95fr) minmax(0, 2.85fr) minmax(
      215px,
      1fr
    );
  gap: 20px;
  align-items: start;
}
.left-rail,
.right-rail,
.center-column {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.instrument {
  border: 1px solid var(--p-line);
  background: linear-gradient(135deg, #0e1d2ee8, #0a1625e8);
  border-radius: 4px;
  position: relative;
  min-width: 0;
}
.instrument::before {
  content: '';
  position: absolute;
  top: -1px;
  left: -1px;
  width: 13px;
  height: 13px;
  border-top: 2px solid #5c91a0;
  border-left: 2px solid #5c91a0;
  border-radius: 3px 0 0 0;
  pointer-events: none;
}
.panel-heading {
  padding: 17px 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid #21364a;
}
.panel-heading h2 {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1.4;
  margin: 0;
}
.panel-heading > span {
  font: 9px var(--font-mono);
  color: var(--p-muted);
  letter-spacing: 0.07em;
  white-space: nowrap;
}
.panel-heading p {
  font-size: 11px;
  color: var(--p-muted);
  margin: 5px 0 0;
  line-height: 1.5;
}
.risk-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 18px 16px;
}
.risk-summary > strong {
  font: 500 42px/1 var(--font-mono);
  color: var(--p-red);
}
.risk-summary > div {
  font-size: 12px;
}
.risk-summary small {
  display: block;
  font-size: 10px;
  color: var(--p-muted);
  margin-top: 7px;
}
.risk-summary > svg {
  margin-left: auto;
  color: #7e586b;
}
.risk-spectrum {
  display: flex;
  height: 6px;
  margin: 0 18px 15px;
  gap: 3px;
  background: #172b3c;
}
.risk-spectrum > i {
  background: currentColor;
  min-width: 0;
}
.risk-list {
  list-style: none;
  padding: 0 18px;
  margin: 0;
  display: grid;
  gap: 12px;
}
.risk-list li {
  display: grid;
  grid-template-columns: 6px 1fr 28px 38px;
  gap: 9px;
  align-items: center;
  font-size: 12px;
}
.risk-list strong {
  font: 13px var(--font-mono);
  text-align: right;
}
.risk-list small {
  font: 11px var(--font-mono);
  color: var(--p-muted);
  text-align: right;
}
.panel-note {
  font-size: 11px;
  line-height: 1.7;
  color: var(--p-muted);
  margin: 18px;
}
.panel-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 12px 18px;
  border-top: 1px solid var(--p-line);
  color: var(--p-cyan);
  font-size: 11px;
  min-height: 42px;
  text-align: left;
}
.panel-link:hover {
  background: #132d3d;
}
.service-list {
  list-style: none;
  padding: 4px 18px 0;
  margin: 0;
}
.service-list li {
  padding: 14px 0 5px;
}
.service-list li > div:first-child {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
}
.ordinal {
  font: 10px var(--font-mono);
  color: #8097ae;
}
.service-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 1;
}
.service-list strong {
  font: 13px var(--font-mono);
}
.service-track {
  height: 3px;
  margin: 9px 0 0 24px;
  background: #1a3043;
}
.service-track i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #28536b, #7ecbd0);
}
.pipeline-panel {
  background:
    radial-gradient(ellipse at center, #15364b55, transparent 70%), #0b1828;
}
.pipeline-panel .panel-heading {
  padding: 18px 20px;
}
.pipeline-tag {
  padding: 5px 8px;
  border: 1px solid #335267;
  color: var(--p-cyan) !important;
}
.pipeline-diagram {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-template-rows: 114px 114px;
  column-gap: 32px;
  row-gap: 72px;
  margin: 28px 24px 20px;
}
.circuit {
  position: absolute;
  inset: -16px -12px;
  width: calc(100% + 24px);
  height: calc(100% + 32px);
  pointer-events: none;
  color: #4e95a1;
  overflow: visible;
}
.circuit-path {
  fill: none;
  stroke: #3b6c7d;
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}
.circuit-arrow {
  fill: none;
  stroke: currentColor;
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}
.circuit-grid {
  fill: none;
  stroke: #41658030;
  stroke-width: 1;
  stroke-dasharray: 3 9;
  vector-effect: non-scaling-stroke;
}
.diagram-caption {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font: 10px var(--font-mono);
  letter-spacing: 0.09em;
  color: var(--p-muted);
  pointer-events: none;
}
.stage-node {
  position: relative;
  z-index: 1;
  padding: 13px 14px 12px;
  border: 1px solid #355467;
  border-radius: 3px;
  background: linear-gradient(130deg, #112b3d, #0d1d30);
  text-align: left;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 0;
  box-shadow: 0 6px 18px #030b1530;
  transition:
    border-color 0.15s,
    background 0.15s;
}
.stage-node::after {
  content: '';
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 8px;
  height: 8px;
  border-bottom: 2px solid #5899a5;
  border-right: 2px solid #5899a5;
}
.stage-node:hover {
  border-color: var(--p-cyan);
  background: #17354a;
}
.stage-node.selected {
  border-color: var(--p-cyan);
  box-shadow:
    0 0 0 1px #6be4e822,
    inset 0 0 22px #6be4e807;
}
.stage-node.attention .node-main strong {
  color: var(--p-amber);
}
.node-code {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  font: 9px var(--font-mono);
  color: var(--p-muted);
  letter-spacing: 0.04em;
}
.node-code > span {
  color: #7bbbc7;
  font-size: 14px;
  line-height: 9px;
}
.node-main {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-top: 7px;
  min-width: 0;
}
.node-main strong {
  font: 500 30px/1.25 var(--font-mono);
  color: var(--p-cyan);
  letter-spacing: -0.06em;
}
.node-main > span {
  font-size: 12px;
  font-weight: 500;
}
.node-caption {
  font-size: 10px;
  color: var(--p-muted);
  line-height: 1.5;
  margin-top: 5px;
}
.node-approve {
  grid-column: 3;
  grid-row: 2;
}
.node-ready {
  grid-column: 2;
  grid-row: 2;
}
.node-consumed {
  grid-column: 1;
  grid-row: 2;
}
.node-consumed .node-main {
  gap: 7px;
}
.branch-row {
  padding: 13px 20px;
  display: flex;
  gap: 12px;
  align-items: center;
  border-top: 1px dashed #2b4257;
  font-size: 11px;
  color: var(--p-muted);
  flex-wrap: wrap;
}
.branch-marker {
  color: #6797ab;
  font: 20px var(--font-mono);
}
.branch-row button {
  border: 1px solid #31455c;
  padding: 7px 10px;
  display: flex;
  gap: 18px;
  align-items: center;
  border-radius: 2px;
  font-size: 11px;
}
.branch-row button strong {
  font: 12px var(--font-mono);
  color: var(--p-text);
}
.branch-row button:hover,
.branch-row button.selected {
  color: var(--p-cyan);
  border-color: var(--p-cyan);
}
.pipeline-foot {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 20px;
  background: #07132188;
  border-top: 1px solid var(--p-line);
  font-size: 10px;
  line-height: 1.6;
  color: var(--p-muted);
}
.pipeline-foot > span:last-child {
  flex: none;
  color: #adbdcb;
}
.result-count {
  margin-left: 10px;
  font: 11px var(--font-mono);
  color: var(--p-cyan);
  border-left: 1px solid #405c73;
  padding-left: 10px;
}
.text-control {
  font-size: 11px;
  color: var(--p-cyan);
  padding: 7px 0;
  white-space: nowrap;
}
.text-control:hover {
  text-decoration: underline;
  text-underline-offset: 4px;
}
.change-row {
  width: 100%;
  padding: 13px 18px;
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
  border-bottom: 1px solid #1e3144;
  min-height: 66px;
}
.change-row:hover {
  background: #142b3e;
}
.change-mark {
  width: 3px;
  height: 26px;
  background: currentColor;
  opacity: 0.8;
  flex: none;
}
.change-info {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
  flex: 1;
}
.change-title {
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.change-meta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  font: 9px var(--font-mono);
  color: var(--p-muted);
  line-height: 1.6;
}
.change-meta > span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.change-state {
  font-size: 11px;
  flex: none;
  text-align: right;
  max-width: 150px;
  overflow-wrap: anywhere;
}
.change-state small {
  display: block;
  font-size: 10px;
  color: var(--p-muted);
  margin-top: 7px;
}
.row-arrow {
  color: #8cb4c8;
  font-size: 14px;
}
.list-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 18px;
  color: var(--p-muted);
  font-size: 10px;
}
.empty-state {
  font-size: 12px;
  line-height: 1.8;
  color: var(--p-muted);
  padding: 26px 18px;
  margin: 0;
}
.list-empty {
  min-height: 176px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 9px;
}
.list-empty strong {
  font-size: 13px;
  color: var(--p-text);
  font-weight: 500;
}
.list-empty > svg {
  color: #678ba2;
  margin-bottom: 4px;
}
.rule-list {
  list-style: none;
  margin: 0;
  padding: 0 18px;
}
.rule-list li + li {
  border-top: 1px solid #263b4f;
}
.rule-list button {
  display: block;
  width: 100%;
  text-align: left;
  padding: 16px 0;
}
.rule-list button:hover strong {
  color: var(--p-cyan);
}
.rule-top {
  display: flex;
  justify-content: space-between;
  color: var(--p-amber);
  font: 10px var(--font-mono);
  margin-bottom: 10px;
}
.rule-list strong {
  font-size: 12px;
  font-weight: 400;
  line-height: 1.65;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}
.rule-list small {
  font: 9px var(--font-mono);
  color: var(--p-muted);
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 8px;
}
.source-list {
  margin: 0;
  padding: 5px 18px;
}
.source-list > div {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #223649;
}
.source-list dt {
  font-size: 11px;
  color: var(--p-muted);
}
.source-list dd {
  font: 11px var(--font-mono);
  margin: 0;
}
.boundary-note {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 3px 3px 0;
  color: #b5c8d8;
}
.boundary-icon {
  font: 11px var(--font-mono);
  width: 16px;
  height: 16px;
  border: 1px solid #627e95;
  text-align: center;
  flex: none;
  line-height: 14px;
  margin-top: 1px;
}
.boundary-note p {
  font-size: 11px;
  line-height: 1.8;
  margin: 0;
}
.boundary-note small {
  font-size: 10px;
  color: var(--p-muted);
  display: block;
  margin-top: 4px;
}
.room-footer {
  margin-top: 24px;
  padding-top: 14px;
  border-top: 1px solid #21364a;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  font: 9px var(--font-mono);
  letter-spacing: 0.05em;
  color: var(--p-muted);
}
.room-footer > span:first-child {
  display: flex;
  align-items: center;
  gap: 8px;
}
@media (min-width: 1700px) {
  .panorama-room {
    padding: 34px 44px 22px;
  }
  .room-grid {
    grid-template-columns: minmax(270px, 1fr) minmax(0, 3fr) minmax(270px, 1fr);
    gap: 24px;
  }
  .pipeline-diagram {
    grid-template-rows: 130px 130px;
    row-gap: 90px;
    margin: 34px 34px 24px;
  }
  .stage-node {
    padding: 16px 20px;
  }
  .node-main strong {
    font-size: 38px;
  }
  .node-main > span {
    font-size: 14px;
  }
  .node-caption {
    font-size: 11px;
  }
  .change-row {
    min-height: 74px;
  }
  .metric-value {
    font-size: 46px;
  }
}
@media (max-width: 1199px) {
  .panorama-room {
    padding: 24px;
  }
  .room-grid {
    grid-template-columns: minmax(210px, 1fr) minmax(0, 2.8fr);
  }
  .right-rail {
    grid-column: 1/-1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: start;
  }
  .boundary-note {
    grid-column: 1/-1;
  }
  .metric {
    padding: 16px;
  }
  .metric-value {
    font-size: 34px;
  }
  .metric::after {
    left: 16px;
  }
  .product-name > span {
    display: none;
  }
  .node-main {
    flex-wrap: wrap;
    gap: 2px 8px;
  }
  .pipeline-diagram {
    column-gap: 20px;
    margin-inline: 18px;
  }
  .snapshot {
    margin-right: 0;
  }
}
@media (max-width: 900px) {
  .room-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .center-column {
    grid-row: 1;
  }
  .left-rail {
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: start;
  }
  .room-header {
    align-items: flex-start;
  }
  .header-actions {
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
  }
  .snapshot {
    width: 100%;
    justify-content: flex-end;
  }
  .metric {
    padding: 14px 12px;
  }
  .metric-value {
    font-size: 30px;
  }
  .metric-value small {
    font-size: 10px;
    margin-left: 5px;
  }
  .metric-code {
    font-size: 8px;
    letter-spacing: 0.03em;
  }
  .metric-label {
    font-size: 11px;
  }
  .metric-tick {
    display: none;
  }
  .node-main {
    flex-wrap: nowrap;
  }
  .pipeline-diagram {
    margin-inline: 26px;
    column-gap: 38px;
  }
  .room-footer {
    flex-wrap: wrap;
    line-height: 1.6;
  }
}
@media (max-width: 560px) {
  .panorama-room {
    padding: 20px 16px 18px;
  }
  .room-header {
    flex-direction: column;
    gap: 20px;
    margin-bottom: 20px;
  }
  .identity {
    gap: 12px;
  }
  .brand-symbol {
    height: 42px;
    width: 42px;
  }
  .product-name {
    font-size: 12px;
  }
  .product-name > span {
    display: inline;
    font-size: 8px;
  }
  h1 {
    font-size: 23px;
  }
  .header-actions {
    width: 100%;
    flex-wrap: nowrap;
    justify-content: flex-start;
    gap: 8px;
  }
  .snapshot {
    width: auto;
    flex: 1;
    justify-content: flex-start;
    font-size: 10px;
    gap: 6px;
  }
  .snapshot small {
    font-size: 9px;
    white-space: nowrap;
  }
  .control {
    height: 44px;
    padding: 0 10px;
    font-size: 11px;
    gap: 5px;
  }
  .control > svg {
    display: none;
  }
  .telemetry {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin-bottom: 20px;
  }
  .metric {
    padding: 15px 16px;
    border-bottom: 1px solid var(--p-line);
  }
  .metric:nth-child(odd) {
    border-left: 0;
  }
  .metric:last-child {
    grid-column: 1/-1;
    border-bottom: 0;
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
  }
  .metric:last-child .metric-value {
    grid-column: 2;
    grid-row: 1/3;
    margin: 0;
  }
  .metric:last-child .metric-code {
    grid-column: 1;
  }
  .metric-value {
    font-size: 34px;
  }
  .metric-code {
    font-size: 8px;
  }
  .metric-label {
    font-size: 12px;
  }
  .metric-tick {
    display: inline;
  }
  .room-grid,
  .left-rail,
  .right-rail {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .center-column {
    order: 0;
    width: 100%;
    gap: 18px;
  }
  .left-rail {
    order: 1;
    width: 100%;
  }
  .right-rail {
    order: 2;
    width: 100%;
  }
  .left-rail > *,
  .right-rail > * {
    width: 100%;
    box-sizing: border-box;
  }
  .panel-heading {
    padding: 16px;
  }
  .pipeline-panel .panel-heading {
    padding: 16px;
  }
  .panel-heading h2 {
    font-size: 13px;
  }
  .pipeline-diagram {
    display: flex;
    flex-direction: column;
    gap: 18px;
    margin: 20px 20px 18px;
    padding-left: 18px;
    border-left: 1px solid #395d71;
  }
  .circuit,
  .diagram-caption {
    display: none;
  }
  .stage-node {
    min-height: 100px;
    padding: 12px 16px;
    position: relative;
  }
  .stage-node::before {
    content: '';
    position: absolute;
    left: -22px;
    top: 50%;
    width: 6px;
    height: 6px;
    background: var(--p-cyan);
    box-shadow: 0 0 0 4px #0b1828;
  }
  .node-main {
    gap: 14px;
  }
  .node-main strong {
    font-size: 30px;
  }
  .node-main > span {
    font-size: 13px;
  }
  .node-code {
    font-size: 9px;
  }
  .node-caption {
    font-size: 11px;
  }
  .branch-row {
    padding: 12px 16px;
    gap: 8px;
  }
  .branch-row button {
    min-height: 44px;
    gap: 10px;
  }
  .pipeline-foot {
    padding: 12px 16px;
    flex-direction: column;
    gap: 3px;
    font-size: 10px;
  }
  .change-row {
    padding: 14px 13px;
    gap: 9px;
    align-items: flex-start;
  }
  .change-mark {
    margin-top: 3px;
  }
  .change-title {
    font-size: 12px;
  }
  .change-state {
    max-width: 88px;
    font-size: 10px;
    line-height: 1.5;
  }
  .change-meta {
    gap: 3px;
    font-size: 8px;
    flex-direction: column;
  }
  .row-arrow {
    display: none;
  }
  .list-foot {
    padding: 8px 14px;
    gap: 8px;
    font-size: 9px;
  }
  .text-control {
    min-height: 44px;
    font-size: 11px;
  }
  .room-footer {
    font-size: 8px;
    gap: 10px;
    margin-top: 20px;
  }
  .empty-state {
    font-size: 12px;
  }
  .notice {
    font-size: 12px;
    padding: 12px;
  }
}
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
}
</style>
