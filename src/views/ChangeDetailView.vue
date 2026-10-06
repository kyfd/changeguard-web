<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWorkspaceStore, useAuthStore } from '@/stores/workspace.ts'
import { api } from '@/api/client.ts'
import { useToast } from '@/composables/useToast.ts'
import TechIcon from '@/components/TechIcon.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import NeonButton from '@/components/NeonButton.vue'
import { STATUS_LABEL, checkSummary, fmtTime } from '@/lib/labels.ts'

import PassportStepsBar from './change-detail/PassportStepsBar.vue'
import FindingsList from './change-detail/FindingsList.vue'
import ChangeAssistantPanel from './change-detail/ChangeAssistantPanel.vue'

const route = useRoute()
const router = useRouter()
const ws = useWorkspaceStore()
const auth = useAuthStore()
const toast = useToast()

const changeId = computed(() => String(route.params.id || ''))
const detail = ref<any>(null)
const detailLoading = ref(false)
const detailError = ref('')
const detailErrorStatus = ref(0)
const change = computed(() => detail.value || ws.changes.find((c) => c.id === changeId.value))
const summary = computed(() => checkSummary(change.value))

const riskLabel: Record<string, string> = {
  HIGH: '高危',
  MEDIUM: '中危',
  LOW: '低危',
  UNKNOWN: '待定',
}

const evLabel: Record<string, string> = {
  REAL: '真实',
  NOT_RUN: '未验证',
  FAILED: '失败',
  DEMO_ONLY: '演示',
}

function owner(c: any) {
  return c.owner_name || c.owner || c.reviewer_name || '—'
}

function fmt(t?: string) {
  if (!t) return '—'
  const value = new Date(t)
  if (!Number.isFinite(value.getTime())) return '—'
  return fmtTime(t)
}

// ---- 变更助手 ----
const asking = ref(false)
const qaList = ref<any[]>([])
const conversationId = ref('')
const historyLoading = ref(false)

function mapAgentMessage(message: any) {
  return {
    id: message?.id || 'msg_' + Date.now(),
    conversation_id: message?.conversation_id || '',
    question: message?.question || '',
    answer: message?.answer || message?.content || '',
    citations: message?.citations || [],
    trace: message?.trace || [],
    proposals: message?.proposals || [],
    created_at: message?.created_at || new Date().toISOString(),
  }
}

async function loadChange(force = false) {
  if (!changeId.value || detailLoading.value) return
  const cached = ws.changes.find((c) => c.id === changeId.value)
  if (cached && !force) detail.value = cached
  detailLoading.value = true
  detailError.value = ''
  detailErrorStatus.value = 0
  try {
    const result = await api.change(changeId.value)
    detail.value = result
    ws.replaceChange(result)
  } catch (e: any) {
    detailErrorStatus.value = Number(e?.status || 0)
    detailError.value = e?.message || '变更详情加载失败'
    if (!cached) detail.value = null
  } finally {
    detailLoading.value = false
  }
}

async function loadConversationHistory() {
  if (!changeId.value || historyLoading.value) return
  historyLoading.value = true
  try {
    const raw = await api.agentConversations(changeId.value)
    const conversations = Array.isArray(raw) ? raw : raw?.conversations || raw?.items || []
    const current = conversations[0]
    const id = current?.id || current?.conversation?.id || current?.conversation_id || ''
    if (!id) return
    const summary = await api.agentConversation(changeId.value, id)
    conversationId.value = summary?.conversation?.id || id
    qaList.value = (summary?.messages || []).map(mapAgentMessage).filter((m) => m.question || m.answer)
  } catch (e: any) {
    if (e?.status !== 404 && e?.status !== 405) {
      qaList.value.push({
        id: 'history_err',
        question: '',
        answer: '历史问答暂时无法加载：' + (e?.message || '请稍后重试'),
        error: true,
        created_at: new Date().toISOString(),
      })
    }
  } finally {
    historyLoading.value = false
  }
}

async function askAgent(q: string) {
  if (!q || asking.value) return
  asking.value = true
  qaList.value.push({
    id: 'pending',
    question: q,
    role: 'user',
    pending: true,
    created_at: new Date().toISOString(),
  })
  try {
    const result = await api.askChangeAssistant(changeId.value, q, conversationId.value)
    qaList.value = qaList.value.filter((m) => m.id !== 'pending')
    const message = mapAgentMessage(result)
    conversationId.value = message.conversation_id || conversationId.value
    qaList.value.push(message)
  } catch (e: any) {
    qaList.value = qaList.value.filter((m) => m.id !== 'pending')
    qaList.value.push({
      id: 'err_' + Date.now(),
      question: q,
      answer: '助手暂不可用：' + (e?.message || '请稍后重试'),
      error: true,
      created_at: new Date().toISOString(),
    })
  } finally {
    asking.value = false
  }
}

function copySql(sqlText: string) {
  if (!sqlText) return
  void navigator.clipboard.writeText(sqlText).then(() => {
    toast.success('SQL 已复制到剪贴板')
  })
}

onMounted(async () => {
  await loadChange()
  await loadConversationHistory()
})

watch(changeId, async () => {
  detail.value = null
  qaList.value = []
  conversationId.value = ''
  await loadChange()
  await loadConversationHistory()
})

function back() {
  router.push({ name: 'changes' })
}
</script>

<template>
  <div class="page" v-if="change">
    <!-- 头部区域：严格左右分列，绝不重叠换行 -->
    <header class="detail-header">
      <div class="header-main-info">
        <div class="page-kicker mono">PASSPORT VERIFICATION</div>
        <h1 class="change-hero-title">{{ change.title || '未命名变更单' }}</h1>
        <div class="meta-capsule-cluster">
          <span class="meta-tag mono">{{ change.id }}</span>
          <span class="meta-sep">/</span>
          <span class="meta-item">{{ change.application_name || change.application_id || '未关联服务' }}</span>
          <span class="meta-sep">/</span>
          <span class="meta-item mono">提交于 {{ fmt(change.created_at) }}</span>
        </div>
      </div>

      <div class="header-action-cluster">
        <NeonButton variant="ghost" size="md" @click="back">
          <TechIcon name="arrow" :size="15" /> 返回工单列表
        </NeonButton>
        <NeonButton variant="ghost" size="md" :loading="detailLoading" @click="loadChange(true)">
          <TechIcon name="refresh" :size="15" /> 重新校验
        </NeonButton>
      </div>
    </header>

    <!-- 通行证步进条 -->
    <PassportStepsBar :status="change.status" />

    <!-- 主展示网格 -->
    <div class="detail-grid">
      <!-- 左侧内容区 -->
      <main class="detail-main">
        <!-- 核心状态卡片 -->
        <section class="dpanel">
          <div class="dpanel-head">
            <h3>变更准入状态</h3>
          </div>

          <div class="status-verdict-box">
            <StatusBadge type="status" :value="change.status" size="md">
              {{ STATUS_LABEL[change.status] || change.status }}
            </StatusBadge>
            <div class="verdict-summary">{{ summary }}</div>
          </div>

          <p class="status-disclaimer">
            门禁通行证仅证明变更材料与静态规则通过检验；实际部署结果请前往 CI/CD 生产日志核对。
          </p>

          <div class="attribute-pill-grid">
            <div class="attr-pill">
              <span class="attr-dot" :class="change.risk === 'HIGH' ? 'dot-err' : change.risk === 'MEDIUM' ? 'dot-warn' : 'dot-ok'"></span>
              <span class="attr-name">风险评级：</span>
              <strong class="attr-val">{{ riskLabel[change.risk] || change.risk }}</strong>
            </div>

            <div class="attr-pill">
              <span class="attr-dot dot-ok"></span>
              <span class="attr-name">发布环境：</span>
              <strong class="attr-val">{{ change.environment || '生产预备' }}</strong>
            </div>

            <div class="attr-pill">
              <span class="attr-dot dot-warn"></span>
              <span class="attr-name">证据类型：</span>
              <strong class="attr-val">{{ evLabel[change.evidence_state] || '未验证' }}</strong>
            </div>

            <div v-if="owner(change) !== '—'" class="attr-pill">
              <span class="attr-dot dot-ok"></span>
              <span class="attr-name">负责人：</span>
              <strong class="attr-val">{{ owner(change) }}</strong>
            </div>
          </div>

          <div v-if="change.description" class="desc-callout">
            {{ change.description }}
          </div>

          <!-- SQL 代码块 -->
          <div class="sql-code-panel" v-if="change.sql">
            <div class="sql-panel-header">
              <div class="code-badge mono">SQL · DDL / DML</div>
              <button class="copy-btn" type="button" @click="copySql(change.sql)">
                复制语句
              </button>
            </div>
            <pre class="sql-content mono">{{ change.sql }}</pre>
          </div>

          <div class="sql-code-panel" v-if="change.rollback_sql">
            <div class="sql-panel-header">
              <div class="code-badge rollback mono">ROLLBACK SQL · 回滚计划</div>
              <button class="copy-btn" type="button" @click="copySql(change.rollback_sql)">
                复制语句
              </button>
            </div>
            <pre class="sql-content mono">{{ change.rollback_sql }}</pre>
          </div>
        </section>

        <!-- 确定性检查项 -->
        <FindingsList
          :findings="change.findings"
          :check-run="change.check_run || change.checkRun"
          :summary="summary"
        />

        <!-- 变更智能助手 -->
        <ChangeAssistantPanel
          :qa-list="qaList"
          :asking="asking"
          :user-name="auth.user?.name"
          @ask="askAgent"
        />
      </main>

      <!-- 右侧信息侧栏 -->
      <aside class="detail-side">
        <section class="dpanel">
          <div class="dpanel-head">
            <h3>责任与流转信息</h3>
          </div>
          <div class="meta-key-value-list">
            <div class="kv-item">
              <span class="kv-key">发起提交人</span>
              <strong class="kv-val">{{ change.submitter_name || '系统同步' }}</strong>
            </div>
            <div class="kv-item">
              <span class="kv-key">审批责任人</span>
              <strong class="kv-val">{{ change.reviewer_name || '等待分配签发' }}</strong>
            </div>
            <div class="kv-item">
              <span class="kv-key">审批结论与意见</span>
              <strong class="kv-val">{{ change.review_comment || '暂无签署附言' }}</strong>
            </div>
            <div class="kv-item">
              <span class="kv-key">版本演进序号</span>
              <strong class="kv-val mono">v{{ change.version || '1.0' }}</strong>
            </div>
          </div>
        </section>

        <section class="dpanel">
          <div class="dpanel-head">
            <h3>全链路时间线</h3>
          </div>
          <div class="timeline-tree">
            <div
              v-for="item in [...(change.timeline || [])].reverse()"
              :key="item.id"
              class="timeline-node"
            >
              <div class="timeline-marker"></div>
              <div class="timeline-body">
                <div class="timeline-title">{{ item.title }}</div>
                <p v-if="item.detail" class="timeline-detail">{{ item.detail }}</p>
                <div class="timeline-footer mono">
                  {{ item.actor }} · {{ fmt(item.created_at) }}
                </div>
              </div>
            </div>
          </div>
        </section>
      </aside>
    </div>
  </div>

  <div class="page detail-state" v-else-if="detailLoading">
    <div class="empty-state-box">
      <div class="loader-spinner"></div>
      <p>正在读取变更防御存证…</p>
    </div>
  </div>

  <div class="page detail-state" v-else>
    <div class="empty-state-box">
      <h3>未找到对应变更记录</h3>
      <p>{{ detailError || '可能变更单已被转移或无权访问' }}</p>
      <NeonButton size="md" @click="back">返回工单列表</NeonButton>
    </div>
  </div>
</template>

<style scoped>
@import './page.css';

/* 头部大标题与操作区 */
.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 24px;
  flex-wrap: nowrap;
}

.header-main-info {
  flex: 1;
  min-width: 0;
}

.change-hero-title {
  margin: 6px 0 10px;
  font-size: 28px;
  font-weight: 800;
  color: var(--text-strong);
  letter-spacing: -0.03em;
  line-height: 1.2;
  word-break: break-word;
}

.meta-capsule-cluster {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-mute);
  flex-wrap: wrap;
}

.meta-tag {
  font-size: 12px;
  font-weight: 700;
  color: var(--brand);
  background: var(--brand-soft);
  border: 1px solid rgba(79, 70, 229, 0.25);
  padding: 2px 8px;
  border-radius: var(--r-xs);
}

.meta-sep {
  color: var(--line-strong);
}

.header-action-cluster {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

/* 主双列布局 */
.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 24px;
  align-items: start;
}

@media (max-width: 1024px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
}

.dpanel {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-xl);
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: var(--shadow-card);
}

.dpanel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--line);
}

.dpanel-head h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-strong);
  letter-spacing: -0.01em;
}

/* 准入状态盒 */
.status-verdict-box {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.verdict-summary {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-strong);
}

.status-disclaimer {
  font-size: 13px;
  color: var(--text-mute);
  line-height: 1.5;
  margin-bottom: 18px;
}

/* 属性胶囊栅格 */
.attribute-pill-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
  margin-bottom: 18px;
}

.attr-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: var(--r);
  font-size: 13px;
}

.attr-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.attr-name {
  color: var(--text-faint);
}
.attr-val {
  color: var(--text-strong);
  font-weight: 600;
}

.desc-callout {
  padding: 12px 16px;
  background: var(--surface-2);
  border-left: 3px solid var(--brand);
  border-radius: 0 var(--r) var(--r) 0;
  font-size: 13.5px;
  color: var(--text);
  line-height: 1.6;
  margin-bottom: 20px;
}

/* SQL 代码块 */
.sql-code-panel {
  margin-top: 16px;
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  overflow: hidden;
}

.sql-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--surface-2);
  border-bottom: 1px solid var(--line);
}

.code-badge {
  font-size: 11px;
  font-weight: 700;
  color: var(--brand);
  letter-spacing: 0.05em;
}
.code-badge.rollback {
  color: var(--amber);
}

.copy-btn {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-mute);
  background: var(--surface);
  border: 1px solid var(--line);
  padding: 3px 10px;
  border-radius: var(--r-sm);
  cursor: pointer;
  transition: all var(--dur-fast);
}
.copy-btn:hover {
  color: var(--brand);
  border-color: var(--brand);
}

.sql-content {
  margin: 0;
  padding: 16px;
  font-size: 13px;
  line-height: 1.6;
  background: #0f172a;
  color: #f8fafc;
  overflow-x: auto;
}

/* 右侧属性列表 */
.meta-key-value-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.kv-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.kv-key {
  font-size: 12px;
  color: var(--text-faint);
}

.kv-val {
  font-size: 14px;
  color: var(--text-strong);
  font-weight: 600;
  word-break: break-word;
}

/* 时间线 */
.timeline-tree {
  display: flex;
  flex-direction: column;
  gap: 20px;
  position: relative;
  padding-left: 20px;
}
.timeline-tree::before {
  content: "";
  position: absolute;
  top: 8px;
  bottom: 8px;
  left: 6px;
  width: 2px;
  background: var(--line);
}

.timeline-node {
  position: relative;
}

.timeline-marker {
  position: absolute;
  left: -20px;
  top: 5px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--brand);
  box-shadow: 0 0 0 3px var(--surface);
}

.timeline-title {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text-strong);
}

.timeline-detail {
  font-size: 12.5px;
  color: var(--text-mute);
  margin: 3px 0;
  line-height: 1.45;
}

.timeline-footer {
  font-size: 11px;
  color: var(--text-faint);
}

.empty-state-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 360px;
  gap: 14px;
  color: var(--text-mute);
}

.loader-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--line);
  border-top-color: var(--brand);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
</style>
