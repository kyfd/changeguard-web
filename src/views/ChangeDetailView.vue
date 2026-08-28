<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWorkspaceStore } from '@/stores/workspace'
import { useAuthStore } from '@/stores/workspace'
import { api } from '@/api/client'
import TechIcon from '@/components/TechIcon.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import NeonButton from '@/components/NeonButton.vue'
import { PASSPORT_STEPS, stepIndex } from '@/lib/labels'

const route = useRoute()
const router = useRouter()
const ws = useWorkspaceStore()
const auth = useAuthStore()

const changeId = computed(() => String(route.params.id || ''))
const detail = ref<any>(null)
const detailLoading = ref(false)
const detailError = ref('')
const detailErrorStatus = ref(0)
const change = computed(() => detail.value || ws.changes.find(c => c.id === changeId.value))
const blockingCount = computed(() => (change.value?.findings || []).filter((f: any) => f.blocking).length)
const openCount = computed(() => (change.value?.findings || []).filter((f: any) => f.status !== 'RESOLVED').length)

const statusLabel: Record<string, string> = {
  DRAFT: '草稿', CHECKING: '检查中', CHECK_FAILED: '检查失败', READY_FOR_EXPERIMENT: '待验证',
  EXPERIMENT_QUEUED: '实验排队', EXPERIMENT_RUNNING: '实验中', WAITING_APPROVAL: '待审批',
  APPROVED: '已批准', COMPLETED: '已完成', REJECTED: '已拒绝',
}
const riskLabel: Record<string, string> = { HIGH: '高', MEDIUM: '中', LOW: '低', UNKNOWN: '待定' }
const evLabel: Record<string, string> = { REAL: '真实', NOT_RUN: '未验证', FAILED: '失败', DEMO_ONLY: '演示' }
function owner(c: any) { return c.owner_name || c.owner || c.reviewer_name || '—' }
function fmt(t?: string) {
  if (!t) return '—'
  const value = new Date(t)
  if (!Number.isFinite(value.getTime())) return '—'
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short' }).format(value)
}
function initials(n?: string) { return (n || 'CG').slice(0, 2).toUpperCase() }

// ---- Clawbot ----
const question = ref('')
const asking = ref(false)
const qaList = ref<any[]>([])
const conversationId = ref('')
const historyLoading = ref(false)
const suggestions = ['这个变更会影响下游哪些服务？', '当前规则阻断项中哪些必须整改后才能批准？', 'SQL 是否有锁表或全表扫描风险？']

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
  const cached = ws.changes.find(c => c.id === changeId.value)
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
    qaList.value = (summary?.messages || []).map(mapAgentMessage).filter(m => m.question || m.answer)
  } catch (e: any) {
    if (e?.status !== 404 && e?.status !== 405) {
      qaList.value.push({ id: 'history_err', question: '', answer: '历史问答暂时无法加载：' + (e?.message || '请稍后重试'), error: true, created_at: new Date().toISOString() })
    }
  } finally {
    historyLoading.value = false
  }
}

async function askAgent(text?: string) {
  const q = (text ?? question.value).trim()
  if (!q || asking.value) return
  asking.value = true
  question.value = ''
  qaList.value.push({ id: 'pending', question: q, role: 'user', pending: true, created_at: new Date().toISOString() })
  try {
    const result = await api.askChangeAssistant(changeId.value, q, conversationId.value)
    qaList.value = qaList.value.filter(m => m.id !== 'pending')
    const message = mapAgentMessage(result)
    conversationId.value = message.conversation_id || conversationId.value
    qaList.value.push(message)
  } catch (e: any) {
    qaList.value = qaList.value.filter(m => m.id !== 'pending')
    qaList.value.push({ id: 'err_' + Date.now(), question: q, answer: '助手暂不可用：' + (e?.message || '请稍后重试'), error: true, created_at: new Date().toISOString() })
  } finally {
    asking.value = false
  }
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

async function back() { router.push({ name: 'changes' }) }
function go(routeName: string) { router.push({ name: routeName }) }

const findingState: Record<string, [string, string]> = {
  OPEN: ['待处理', 'open'], ASSIGNED: ['整改中', 'assigned'], RESOLVED: ['待复核', 'resolved'], VERIFIED: ['已闭环', 'verified'],
}
</script>

<template>
  <div class="page" v-if="change">
    <div class="page-head">
      <div>
        <div class="page-kicker mono">PASSPORT</div>
        <div class="page-title">{{ change.title || '变更单' }}</div>
        <div class="page-sub">
          <span class="mono id-cell">{{ change.id }}</span> · {{ change.application_name || change.application_id || '—' }} · 提交 {{ fmt(change.created_at) }}
        </div>
      </div>
      <div class="page-actions">
        <NeonButton variant="ghost" size="sm" @click="back"><TechIcon name="arrow" :size="15" /> 返回列表</NeonButton>
        <NeonButton size="sm" :loading="detailLoading" @click="loadChange(true)"><TechIcon name="refresh" :size="15" /> 刷新</NeonButton>
      </div>
    </div>

    <ol class="passport">
      <li v-for="(s, i) in PASSPORT_STEPS" :key="s.key" :class="{ on: i === stepIndex(change.status), done: i < stepIndex(change.status) }">
        <em class="mono">{{ String(i + 1).padStart(2, '0') }}</em>
        <span>{{ s.label }}</span>
      </li>
    </ol>

    <div class="detail-grid">
      <div class="detail-main">
        <!-- 状态概览 -->
        <div class="dpanel">
          <div class="dpanel-head"><h3>变更状态</h3></div>
          <!-- 结论先行：流程条已经表达了"卡在第几步"，这里要回答"为什么过不去" -->
          <div v-if="blockingCount" class="verdict blocked">
            <div class="verdict-main">
              <strong>{{ blockingCount }} 项阻断规则未解除，暂不可进入生产</strong>
              <span>共 {{ change.findings?.length || 0 }} 项证据 · {{ openCount }} 项待处理</span>
            </div>
          </div>
          <div v-else-if="change.findings?.length" class="verdict clear">
            <div class="verdict-main">
              <strong>无阻断项</strong>
              <span>{{ change.findings.length }} 项证据已全部通过</span>
            </div>
          </div>
          <div class="status-strip">
            <div class="status-chip"><span class="dot" :class="change.risk === 'HIGH' ? 'dot-err' : change.risk === 'MEDIUM' ? 'dot-warn' : 'dot-ok'"></span> 风险：{{ riskLabel[change.risk] || change.risk }}</div>
            <div class="status-chip"><span class="dot dot-ok"></span> 环境：{{ change.environment || '—' }}</div>
            <div class="status-chip"><span class="dot dot-warn"></span> 证据：{{ evLabel[change.evidence_state] || '未验证' }}</div>
            <div v-if="owner(change) !== '—'" class="status-chip"><span class="dot dot-ok"></span> 负责人：{{ owner(change) }}</div>
          </div>
          <p class="dpanel-desc">{{ change.description || '—' }}</p>
          <div class="sql-block" v-if="change.sql"><strong>变更 SQL</strong><pre class="mono">{{ change.sql }}</pre></div>
          <div class="sql-block" v-if="change.rollback_sql"><strong>回滚 SQL</strong><pre class="mono">{{ change.rollback_sql }}</pre></div>
        </div>

        <!-- 确定性规则检查 -->
        <div class="dpanel">
          <div class="dpanel-head"><h3>确定性规则检查</h3><span>{{ change.findings?.length || 0 }} 项证据</span></div>
          <div v-if="!change.findings?.length" class="empty-full">尚未执行规则检查，提交后生成可复现证据。</div>
          <div class="finding-list" v-else>
            <div v-for="f in change.findings" :key="f.id" class="finding-card">
              <span class="finding-level" :class="String(f.severity || '').toLowerCase()">{{ riskLabel[f.severity] || '—' }}</span>
              <div class="finding-main">
                <div class="finding-title-row">
                  <h4>{{ f.title }}</h4>
                  <span class="finding-state" :class="'finding-state-' + (findingState[f.status]?.[1] || 'open')">{{ findingState[f.status]?.[0] || f.status }}</span>
                </div>
                <p>{{ f.detail }}</p>
                <div v-if="f.evidence" class="finding-evidence mono">{{ f.evidence }}</div>
                <div class="finding-suggestion">建议：{{ f.suggestion }}</div>
                <div class="finding-ownership">
                  <span><b>负责人</b>{{ f.owner_name || '待分配' }}</span>
                  <span><b>规则编号</b>{{ f.code }}</span>
                  <span v-if="f.blocking" class="blocking-tag">阻断</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Clawbot 变更助手 -->
        <div class="dpanel agent-panel">
          <div class="dpanel-head"><h3><TechIcon name="activity" :size="16" /> Clawbot 变更助手</h3><span>只读证据 · 不越权</span></div>
          <div class="agent-qa-list">
            <div v-for="m in qaList" :key="m.id" class="agent-qa-item" :class="{ 'is-pending': m.pending, 'is-error': m.error }">
              <div class="agent-qa-q">
                <span class="avatar">{{ initials(auth.user?.name) }}</span>
                <div><div class="comment-meta"><strong>{{ auth.user?.name || '我' }}</strong><span>{{ fmt(m.created_at) }}</span></div><p>{{ m.question }}</p></div>
              </div>
              <div class="agent-qa-a">
                <div class="agent-qa-a-head"><strong>Clawbot</strong><span v-if="m.trace?.length">{{ m.trace.length }} 项证据</span></div>
                <p v-if="!m.pending">{{ m.answer }}</p>
                <div v-else class="agent-qa-thinking"><span class="agent-qa-dots"><i></i><i></i><i></i></span> 正在读取变更证据…</div>
                <div v-if="m.citations?.length" class="agent-qa-citations">
                  <strong>证据链</strong>
                  <div class="agent-citation-list">
                    <button v-for="c in m.citations" :key="c.kind + c.id" type="button" class="agent-citation" :title="c.summary || ''">
                      <span class="agent-citation-kind">{{ c.kind }}</span><span>{{ c.title || c.id }}</span><code>{{ c.summary }}</code>
                    </button>
                  </div>
                </div>
                <div v-if="m.trace?.length" class="agent-tool-log"><strong>工具轨迹</strong><code v-for="(t, i) in m.trace" :key="t.tool + i" :class="{ 'tool-error': t.error }">{{ t.tool }}{{ t.error ? ' · 失败：' + t.error : t.output ? ' · ' + String(t.output).slice(0, 48) : '' }}</code></div>
                <div v-if="m.proposals?.length" class="agent-proposals">
                  <strong>建议下一步</strong>
                  <span v-for="p in m.proposals" :key="p.type" class="proposal-chip">{{ p.title || p.type }}</span>
                </div>
              </div>
            </div>
          </div>
          <form class="agent-qa-form" @submit.prevent="askAgent()">
            <textarea v-model="question" rows="3" maxlength="1000" placeholder="向变更助手提问，例如：为什么不能审批？怎么整改？"></textarea>
            <div class="agent-qa-suggestions">
              <button v-for="s in suggestions" :key="s" type="button" class="chip" :disabled="asking" @click="askAgent(s)">{{ s }}</button>
            </div>
            <div class="agent-qa-foot">
              <span>只读回答，带证据链；不代替人工审批</span>
              <NeonButton type="submit" size="sm" :loading="asking"><TechIcon name="activity" :size="14" /> 提问</NeonButton>
            </div>
          </form>
        </div>
      </div>

      <!-- 侧栏 -->
      <div class="detail-side">
        <div class="dpanel">
          <div class="dpanel-head"><h3>责任信息</h3></div>
          <div class="side-info">
            <div><span>提交人</span><strong>{{ change.submitter_name }}<br>{{ fmt(change.created_at) }}</strong></div>
            <div><span>审批人</span><strong>{{ change.reviewer_name || '待分配' }}</strong></div>
            <div><span>审批意见</span><strong>{{ change.review_comment || '—' }}</strong></div>
            <div><span>版本</span><strong>V{{ change.version }}</strong></div>
          </div>
        </div>
        <div class="dpanel">
          <div class="dpanel-head"><h3>处理时间线</h3></div>
          <div class="timeline">
            <div v-for="item in [...(change.timeline || [])].reverse()" :key="item.id" class="timeline-item">
              <span class="timeline-dot"></span>
              <div class="timeline-content"><strong>{{ item.title }}</strong><p>{{ item.detail }}</p><span>{{ item.actor }} · {{ fmt(item.created_at) }}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="page detail-state" v-else-if="detailLoading">
    <div class="empty-full"><span class="state-spinner"></span> 正在加载变更详情…</div>
  </div>
  <div class="page detail-state" v-else>
    <div class="detail-error" role="alert">
      <TechIcon name="shield-alert" :size="24" />
      <strong>{{ detailErrorStatus === 404 ? '变更不存在' : detailErrorStatus === 403 ? '无权查看此变更' : '变更详情加载失败' }}</strong>
      <span>{{ detailError || '未找到对应的变更记录' }}</span>
      <div class="page-actions"><NeonButton variant="ghost" size="sm" @click="back">返回列表</NeonButton><NeonButton size="sm" :loading="detailLoading" @click="loadChange(true)">重试</NeonButton></div>
    </div>
  </div>
</template>

<style scoped>
@import './page.css';
.passport {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.4rem;
  margin: 0 0 0.7rem; padding: 0; list-style: none; flex: none;
}
.passport li {
  display: flex; flex-direction: column; gap: 0.12rem;
  padding: 0.45rem 0.6rem; border-radius: var(--r);
  background: var(--glass); border: 1px solid var(--line); color: var(--text-faint);
}
.passport em { font-size: var(--fs-11); letter-spacing: 0.08em; }
.passport span { font-size: var(--fs-13); color: var(--text-mute); }
.passport li.done { border-color: rgba(198,163,106,.28); }
.passport li.done span { color: var(--text); }
.passport li.on { border-color: var(--gold); background: var(--gold-soft); }
.passport li.on span { color: var(--text-strong); font-weight: 600; }
.detail-grid { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(240px, 1fr); gap: 0.75rem; align-items: start; min-height: 0; overflow: auto; }
.detail-main, .detail-side { display: grid; gap: 0.7rem; min-width: 0; align-content: start; }
.dpanel { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); box-shadow: var(--shadow-card); padding: 1.15rem 1.3rem; }
.dpanel-head { display: flex; align-items: center; justify-content: space-between; gap: .8rem; margin-bottom: .9rem; padding-bottom: .55rem; border-bottom: 1px solid var(--line); }
.dpanel-head h3 { display: flex; align-items: center; gap: .5rem; font-size: 1rem; color: var(--text-strong); font-weight: 500; }
.dpanel-head h3 svg { color: var(--gold-bright); }
.dpanel-head > span { font-size: var(--fs-12); color: var(--text-faint); }
.status-strip { display: flex; flex-wrap: wrap; gap: .5rem; margin-bottom: .8rem; }
.status-chip { display: inline-flex; align-items: center; gap: .4rem; padding: .35rem .7rem; border-radius: var(--r-pill); background: var(--bg-glass); border: 1px solid var(--line); font-size: var(--fs-13); color: var(--text-mute); }
.dpanel-desc { font-size: var(--fs-14); color: var(--text-mute); line-height: 1.6; margin-bottom: .8rem; }
.sql-block { margin-top: .7rem; }
.sql-block strong { display: block; font-size: var(--fs-12); color: var(--text-faint); margin-bottom: .35rem; letter-spacing: .06em; }
.sql-block pre { margin: 0; padding: .7rem .85rem; border-radius: var(--r-sm); background: var(--bg-deep); border: 1px solid var(--line); font-size: var(--fs-12); color: var(--gold-bright); overflow-x: auto; }
.finding-list { display: grid; gap: .6rem; }
.finding-card { display: grid; grid-template-columns: 34px 1fr; gap: .7rem; padding: .8rem .9rem; border-radius: var(--r); background: var(--bg-glass); border: 1px solid var(--line); }
.finding-level { height: 26px; border-radius: var(--r-sm); display: grid; place-items: center; font-size: var(--fs-12); font-weight: 700; }
.finding-level.high { background: var(--red-soft); color: var(--red-bright); }
.finding-level.medium { background: var(--amber-soft); color: var(--amber); }
.finding-level.low { background: var(--jade-soft); color: var(--jade-bright); }
.finding-main h4 { font-size: var(--fs-14); color: var(--text-strong); margin-bottom: .25rem; }
.finding-main p { font-size: var(--fs-13); color: var(--text-mute); line-height: 1.55; }
.finding-evidence { margin-top: .45rem; padding: .45rem .6rem; border-radius: var(--r-sm); background: var(--bg-deep); border: 1px solid var(--line); font-size: var(--fs-12); color: var(--amber); }
.finding-suggestion { margin-top: .4rem; font-size: var(--fs-13); color: var(--green-bright); }
.finding-ownership { display: flex; flex-wrap: wrap; gap: .5rem 1rem; margin-top: .5rem; font-size: var(--fs-12); color: var(--text-faint); }
.finding-ownership b { color: var(--text-mute); margin-right: .2rem; }
.finding-state { font-size: var(--fs-11); padding: .15em .55em; border-radius: var(--r-pill); }
.finding-state-open { background: var(--red-soft); color: var(--red-bright); }
.finding-state-assigned { background: var(--amber-soft); color: var(--amber); }
.finding-state-resolved { background: var(--blue-soft); color: var(--blue-bright); }
.finding-state-verified { background: var(--green-soft); color: var(--green-bright); }
.finding-title-row { display: flex; align-items: center; justify-content: space-between; gap: .6rem; }
.blocking-tag { padding: .1em .5em; border-radius: var(--r-pill); background: var(--red); color: #fff; font-size: var(--fs-11); }
/* 裁决条：把"能不能上生产"这个结论提到首屏，不必滚到证据列表末尾 */
.verdict {
  display: flex; align-items: center; gap: .7rem;
  padding: .7rem .85rem; margin-bottom: .75rem;
  border: 1px solid var(--line); border-radius: var(--r);
  border-left: 3px solid var(--line-bright);
}
.verdict.blocked { border-left-color: var(--red); background: var(--red-soft); }
.verdict.clear { border-left-color: var(--green, #3fb950); }
.verdict-main { display: grid; gap: .16rem; }
.verdict-main strong { font-size: var(--fs-16); color: var(--text-strong); font-weight: 600; }
.verdict.blocked .verdict-main strong { color: var(--red-bright); }
.verdict-main span { font-size: var(--fs-12); color: var(--text-mute); }

/* Clawbot */
.agent-qa-list { display: grid; gap: .8rem; max-height: 460px; overflow-y: auto; }
.agent-qa-item { display: grid; gap: .45rem; }
.agent-qa-q { display: flex; align-items: flex-start; gap: .6rem; }
.avatar { width: 32px; height: 32px; border-radius: 6px; display: grid; place-items: center; background: var(--gold); color: var(--text-inverse); font-weight: 600; font-size: var(--fs-12); flex: none; }
.comment-meta { display: flex; align-items: center; gap: .5rem; }
.comment-meta strong { font-size: var(--fs-13); color: var(--text-strong); }
.comment-meta span { font-size: var(--fs-12); color: var(--text-faint); }
.agent-qa-q p { font-size: var(--fs-13); color: var(--text); margin-top: .2rem; }
.agent-qa-a { margin-left: 2.6rem; padding: .75rem .85rem; border-radius: var(--r); background: var(--bg-glass); border: 1px solid var(--line); }
.agent-qa-a-head { display: flex; align-items: center; gap: .6rem; margin-bottom: .4rem; }
.agent-qa-a-head strong { font-size: var(--fs-13); color: var(--gold-bright); }
.agent-qa-a-head span { font-size: var(--fs-12); color: var(--text-faint); }
.agent-qa-a > p { font-size: var(--fs-13); line-height: 1.65; white-space: pre-wrap; color: var(--text); }
.agent-qa-thinking { display: flex; align-items: center; gap: .5rem; font-size: var(--fs-13); color: var(--text-faint); }
.agent-qa-dots i { display: inline-block; width: 5px; height: 5px; margin-right: 2px; border-radius: 50%; background: var(--gold); animation: pulse 1.2s infinite; }
.agent-qa-dots i:nth-child(2) { animation-delay: .2s; } .agent-qa-dots i:nth-child(3) { animation-delay: .4s; }
.agent-qa-citations { display: grid; gap: .4rem; margin-top: .6rem; }
.agent-qa-citations > strong, .agent-tool-log > strong, .agent-proposals > strong { font-size: var(--fs-12); color: var(--text-faint); letter-spacing: .06em; }
.agent-citation-list { display: grid; gap: .35rem; }
.agent-citation { display: flex; align-items: center; gap: .55rem; padding: .5rem .6rem; border-radius: var(--r-sm); background: var(--bg-deep); border: 1px solid var(--line); text-align: left; color: var(--text); transition: border-color var(--dur); }
.agent-citation:hover { border-color: var(--line-bright); }
.agent-citation-kind { flex: none; font-family: var(--font-mono); font-size: var(--fs-11); padding: .1em .5em; border-radius: var(--r-sm); background: var(--gold-soft); color: var(--gold-bright); }
.agent-citation > span:nth-child(2) { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; font-size: var(--fs-12); }
.agent-citation code { max-width: 42%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-faint); font-size: var(--fs-11); }
.agent-tool-log { display: flex; flex-wrap: wrap; gap: .35rem; margin-top: .55rem; }
.agent-tool-log code { font-size: var(--fs-11); padding: .15em .5em; border-radius: var(--r-sm); background: var(--bg-deep); border: 1px solid var(--line); color: var(--blue-bright); overflow-wrap: anywhere; }
.agent-tool-log code.tool-error { color: var(--red-bright); border-color: rgba(255,90,112,.35); background: var(--red-soft); }
.agent-proposals { display: flex; flex-wrap: wrap; gap: .4rem; align-items: center; margin-top: .55rem; }
.proposal-chip { font-size: var(--fs-12); padding: .2em .6em; border-radius: var(--r-pill); background: var(--green-soft); color: var(--green-bright); border: 1px solid rgba(16,185,129,.3); }
.agent-qa-form { display: grid; gap: .6rem; margin-top: .9rem; }
.agent-qa-form textarea { width: 100%; min-height: 76px; padding: .65rem .8rem; border-radius: var(--r); background: var(--bg-glass); border: 1px solid var(--line); color: var(--text); font-size: var(--fs-13); outline: none; resize: vertical; font-family: inherit; }
.agent-qa-form textarea:focus { border-color: var(--gold); box-shadow: 0 0 0 3px var(--gold-soft); }
.agent-qa-suggestions { display: flex; flex-wrap: wrap; gap: .4rem; }
.chip { font-size: var(--fs-12); padding: .28em .7em; border-radius: var(--r-pill); background: var(--bg-glass); border: 1px solid var(--line); color: var(--text-mute); transition: all var(--dur); }
.chip:hover:not(:disabled) { color: var(--gold-bright); border-color: var(--line-bright); }
.chip:disabled { opacity: .5; cursor: not-allowed; }
.agent-qa-foot { display: flex; align-items: center; justify-content: space-between; gap: .8rem; }
.agent-qa-foot span { font-size: var(--fs-12); color: var(--text-faint); }

.side-info { display: grid; gap: .6rem; }
.side-info > div { display: grid; gap: .15rem; }
.side-info span { font-size: var(--fs-12); color: var(--text-faint); }
.side-info strong { font-size: var(--fs-13); color: var(--text-strong); font-weight: 600; line-height: 1.5; }
.timeline { display: grid; gap: .65rem; max-height: 360px; overflow-y: auto; }
.timeline-item { display: flex; gap: .6rem; }
.timeline-dot { width: 8px; height: 8px; margin-top: 5px; flex: none; border-radius: 50%; background: var(--gold); }
.timeline-content strong { font-size: var(--fs-13); color: var(--text-strong); display: block; }
.timeline-content p { font-size: var(--fs-12); color: var(--text-mute); line-height: 1.5; margin: .15rem 0; }
.timeline-content > span { font-size: var(--fs-11); color: var(--text-faint); }
.empty-full { text-align: center; color: var(--text-faint); padding: 3rem; font-size: var(--fs-14); }
.detail-state { display: grid; place-items: center; overflow: auto; }
.detail-error { min-width: min(460px, 100%); display: grid; justify-items: center; gap: .65rem; padding: 2rem; border: 1px solid var(--line); border-radius: var(--r-lg); background: var(--glass); text-align: center; }
.detail-error svg { color: var(--red-bright); }
.detail-error strong { color: var(--text-strong); font-size: 1rem; }
.detail-error > span { color: var(--text-mute); font-size: var(--fs-13); }
.state-spinner { display: inline-block; width: 1em; height: 1em; margin-right: .4rem; border: 2px solid var(--line-bright); border-top-color: var(--gold); border-radius: 50%; animation: spin .7s linear infinite; }

@media (max-width: 980px) {
  .detail-grid { grid-template-columns: 1fr; }
  .passport { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 620px) {
  .passport { grid-template-columns: 1fr; }
  .dpanel { padding: .85rem; }
  .status-strip { display: grid; grid-template-columns: 1fr; }
  .status-chip { justify-content: flex-start; }
  .finding-card { grid-template-columns: 28px minmax(0, 1fr); padding: .7rem; }
  .finding-title-row, .agent-qa-foot { align-items: flex-start; flex-direction: column; }
  .agent-qa-a { margin-left: 0; }
  .agent-citation { align-items: flex-start; flex-wrap: wrap; }
  .agent-citation code { max-width: 100%; width: 100%; white-space: normal; overflow-wrap: anywhere; }
}
</style>
