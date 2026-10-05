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
    <!-- 页面标题与操作 -->
    <div class="page-head">
      <div>
        <div class="page-kicker mono">PASSPORT</div>
        <div class="page-title">{{ change.title || '变更单' }}</div>
        <div class="page-sub">
          <span class="mono id-cell">{{ change.id }}</span> ·
          {{ change.application_name || change.application_id || '—' }} · 提交
          {{ fmt(change.created_at) }}
        </div>
      </div>
      <div class="page-actions">
        <NeonButton variant="ghost" size="sm" @click="back">
          <TechIcon name="arrow" :size="15" /> 返回列表
        </NeonButton>
        <NeonButton size="sm" :loading="detailLoading" @click="loadChange(true)">
          <TechIcon name="refresh" :size="15" /> 刷新
        </NeonButton>
      </div>
    </div>

    <!-- 通行证步骤条 -->
    <PassportStepsBar :status="change.status" />

    <div class="detail-grid">
      <!-- 左侧主区 -->
      <div class="detail-main">
        <!-- 变更状态卡片 -->
        <div class="dpanel">
          <div class="dpanel-head">
            <h3>变更状态</h3>
          </div>
          <div class="status-summary-row">
            <StatusBadge type="status" :value="change.status">
              {{ STATUS_LABEL[change.status] || change.status }}
            </StatusBadge>
            <span class="summary-text">{{ summary }}</span>
          </div>

          <p class="notice-caption">
            通行证消费不代表部署成功，部署结果请查看 CI 或运行记录。
          </p>

          <div class="status-strip">
            <div class="status-chip">
              <span
                class="dot"
                :class="
                  change.risk === 'HIGH'
                    ? 'dot-err'
                    : change.risk === 'MEDIUM'
                      ? 'dot-warn'
                      : 'dot-ok'
                "
              ></span>
              风险：{{ riskLabel[change.risk] || change.risk }}
            </div>
            <div class="status-chip">
              <span class="dot dot-ok"></span> 环境：{{
                change.environment || '—'
              }}
            </div>
            <div class="status-chip">
              <span class="dot dot-warn"></span> 证据：{{
                evLabel[change.evidence_state] || '未验证'
              }}
            </div>
            <div v-if="owner(change) !== '—'" class="status-chip">
              <span class="dot dot-ok"></span> 负责人：{{ owner(change) }}
            </div>
          </div>

          <p v-if="change.description" class="change-desc">
            {{ change.description }}
          </p>

          <div class="sql-block" v-if="change.sql">
            <div class="sql-header">
              <strong>变更 SQL</strong>
              <button class="sql-copy-btn" type="button" @click="copySql(change.sql)">
                复制 SQL
              </button>
            </div>
            <pre class="mono">{{ change.sql }}</pre>
          </div>

          <div class="sql-block" v-if="change.rollback_sql">
            <div class="sql-header">
              <strong>回滚 SQL</strong>
              <button class="sql-copy-btn" type="button" @click="copySql(change.rollback_sql)">
                复制 SQL
              </button>
            </div>
            <pre class="mono">{{ change.rollback_sql }}</pre>
          </div>
        </div>

        <!-- 确定性规则检查 -->
        <FindingsList
          :findings="change.findings"
          :check-run="change.check_run || change.checkRun"
          :summary="summary"
        />

        <!-- 变更助手（可选） -->
        <ChangeAssistantPanel
          :qa-list="qaList"
          :asking="asking"
          :user-name="auth.user?.name"
          @ask="askAgent"
        />
      </div>

      <!-- 右侧信息栏 -->
      <aside class="detail-side">
        <div class="dpanel">
          <div class="dpanel-head">
            <h3>责任信息</h3>
          </div>
          <div class="side-info">
            <div>
              <span>提交人</span>
              <strong>{{ change.submitter_name }}<br />{{ fmt(change.created_at) }}</strong>
            </div>
            <div>
              <span>审批人</span>
              <strong>{{ change.reviewer_name || '待分配' }}</strong>
            </div>
            <div>
              <span>审批意见</span>
              <strong>{{ change.review_comment || '—' }}</strong>
            </div>
            <div>
              <span>版本</span>
              <strong>V{{ change.version }}</strong>
            </div>
          </div>
        </div>

        <div class="dpanel">
          <div class="dpanel-head">
            <h3>处理时间线</h3>
          </div>
          <div class="timeline">
            <div
              v-for="item in [...(change.timeline || [])].reverse()"
              :key="item.id"
              class="timeline-item"
            >
              <span class="timeline-dot"></span>
              <div class="timeline-content">
                <strong>{{ item.title }}</strong>
                <p>{{ item.detail }}</p>
                <span>{{ item.actor }} · {{ fmt(item.created_at) }}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>

  <!-- 加载状态 -->
  <div class="page detail-state" v-else-if="detailLoading">
    <div class="empty-full">
      <span class="state-spinner"></span> 正在加载变更详情…
    </div>
  </div>

  <!-- 错误状态 -->
  <div class="page detail-state" v-else>
    <div class="empty-full">
      <h3>无法读取变更记录</h3>
      <p>{{ detailError || '工单不存在或权限不足' }}</p>
      <NeonButton size="sm" @click="back">返回变更列表</NeonButton>
    </div>
  </div>
</template>

<style scoped>
.id-cell {
  background: var(--surface-2);
  padding: 1px 6px;
  border-radius: var(--r-sm);
  border: 1px solid var(--line);
}

.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: var(--sp-6);
  align-items: start;
}

@media (max-width: 960px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
}

.dpanel {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-xl);
  padding: var(--sp-5);
  margin-bottom: var(--sp-5);
}

.dpanel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--sp-4);
}

.dpanel-head h3 {
  margin: 0;
  font-size: var(--fs-16);
  font-weight: var(--fw-semibold);
  color: var(--text-strong);
}

.status-summary-row {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  margin-bottom: var(--sp-2);
}

.summary-text {
  font-size: var(--fs-13);
  color: var(--text);
}

.notice-caption {
  font-size: var(--fs-12);
  color: var(--text-mute);
  margin: var(--sp-2) 0;
}

.status-strip {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-3);
  margin: var(--sp-3) 0;
}

.status-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  padding: 4px 10px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: var(--r-pill);
  font-size: var(--fs-12);
  color: var(--text);
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.dot-ok {
  background: var(--jade);
}
.dot-warn {
  background: var(--amber);
}
.dot-err {
  background: var(--cinnabar);
}

.change-desc {
  font-size: var(--fs-13);
  color: var(--text);
  line-height: var(--lh-base);
  margin: var(--sp-3) 0;
}

.sql-block {
  margin-top: var(--sp-3);
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: var(--r);
  overflow: hidden;
}

.sql-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-2) var(--sp-3);
  background: var(--surface);
  border-bottom: 1px solid var(--line);
  font-size: var(--fs-12);
  color: var(--text-mute);
}

.sql-copy-btn {
  background: transparent;
  border: 1px solid var(--line);
  border-radius: var(--r-xs);
  padding: 2px 6px;
  font-size: var(--fs-11);
  color: var(--text-mute);
  cursor: pointer;
  transition: all var(--dur-fast);
}

.sql-copy-btn:hover {
  color: var(--brand);
  border-color: var(--brand);
}

.sql-block pre {
  margin: 0;
  padding: var(--sp-3);
  font-size: var(--fs-12);
  overflow-x: auto;
  color: var(--text-strong);
}

.side-info {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  font-size: var(--fs-13);
}

.side-info span {
  display: block;
  font-size: var(--fs-11);
  color: var(--text-mute);
  margin-bottom: 2px;
}

.side-info strong {
  color: var(--text-strong);
  font-weight: var(--fw-medium);
}

.timeline {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  position: relative;
  padding-left: var(--sp-4);
}

.timeline::before {
  content: '';
  position: absolute;
  top: 6px;
  bottom: 6px;
  left: 3px;
  width: 2px;
  background: var(--line);
}

.timeline-item {
  position: relative;
}

.timeline-dot {
  position: absolute;
  left: calc(-1 * var(--sp-4) + 1px);
  top: 5px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--brand);
  border: 2px solid var(--surface);
}

.timeline-content strong {
  display: block;
  font-size: var(--fs-13);
  color: var(--text-strong);
}

.timeline-content p {
  margin: 2px 0 4px;
  font-size: var(--fs-12);
  color: var(--text-mute);
}

.timeline-content span {
  font-size: var(--fs-11);
  color: var(--text-faint);
}

.detail-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
}

.state-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid var(--line);
  border-top-color: var(--brand);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  vertical-align: middle;
  margin-right: var(--sp-2);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
