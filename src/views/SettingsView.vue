<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useAuthStore } from '@/stores/workspace'
import { api } from '@/api/client'
import TechIcon from '@/components/TechIcon.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import NeonButton from '@/components/NeonButton.vue'
import { useTheme, type ThemePref } from '@/composables/useTheme'

const ws = useWorkspaceStore()
const auth = useAuthStore()
const theme = useTheme()
const themeOpts: { k: ThemePref; label: string }[] = [
  { k: 'dark', label: '深色' },
  { k: 'light', label: '浅色' },
  { k: 'system', label: '跟随系统' },
]
const ent = ref<any>({})
const integrations = ref<any>(null)
const aiConfig = ref<any>(null)
const saving = ref(false)

/* 企业管理员才能管理成员与邀请；后端也有同规则兜底 */
const isAdmin = computed(() => Boolean(auth.user?.enterprise_admin))
const ROLES = ['技术负责人', '数据库审核人', '后端开发'] as const

/* ── 成员 ─────────────────────────────────────────────── */
const members = ref<any[]>([])
const membersBusy = ref<Record<string, boolean>>({})

async function loadMembers() {
  if (!isAdmin.value) return
  try { members.value = await api.enterpriseMembers() || [] } catch {}
}
async function saveMember(member: any, patch: { role?: string; active?: boolean; enterprise_admin?: boolean }) {
  membersBusy.value[member.id] = true
  try {
    // PUT 会整体覆盖角色/启停/企管员，应用授权需先取详情原样带回，避免误清
    const detail = await api.request(`/api/enterprise/members/${encodeURIComponent(member.id)}`)
    const grants = detail?.application_grants || []
    await api.updateMember(member.id, {
      role: patch.role ?? member.role,
      active: patch.active ?? member.active !== false,
      enterprise_admin: patch.enterprise_admin ?? member.enterprise_admin === true,
      application_grants: grants,
    })
    await loadMembers()
  } catch (e: any) { alert(e?.message || '成员更新失败') }
  finally { membersBusy.value[member.id] = false }
}
function changeRole(member: any, role: string) {
  if (role === member.role) return
  if (!confirm(`将成员「${member.name}」的角色调整为「${role}」？`)) { member.role = member.role; return }
  saveMember(member, { role })
}
function toggleActive(member: any) {
  const next = member.active === false
  if (!next && member.active !== false) {
    if (!confirm(`停用「${member.name}」后其将无法登录，确定？`)) return
  }
  saveMember(member, { active: next })
}
function toggleAdmin(member: any) {
  const next = member.enterprise_admin !== true
  if (member.enterprise_admin === true && !confirm(`撤销「${member.name}」的企业管理员身份？`)) return
  saveMember(member, { enterprise_admin: next })
}

/* ── 邀请 ─────────────────────────────────────────────── */
const invites = ref<any[]>([])
const inviteEmail = ref('')
const inviteRole = ref<string>(ROLES[2])
const inviteHours = ref(72)
const inviteBusy = ref(false)
const lastInviteLink = ref('')
const copied = ref('')

async function loadInvites() {
  if (!isAdmin.value) return
  try {
    // 后端返回含已撤销/已接受的全部记录，待处理列表只保留 PENDING
    invites.value = ((await api.enterpriseInvites()) || []).filter((i: any) => i.status === 'PENDING')
  } catch {}
}
async function createInvite() {
  if (!inviteEmail.value.trim() || inviteBusy.value) return
  inviteBusy.value = true
  lastInviteLink.value = ''
  try {
    const res = await api.createInvite({ email: inviteEmail.value.trim(), role: inviteRole.value, expires_in_hours: inviteHours.value })
    lastInviteLink.value = res?.invite_url || ''
    inviteEmail.value = ''
    await loadInvites()
  } catch (e: any) { alert(e?.message || '邀请创建失败') }
  finally { inviteBusy.value = false }
}
async function revokeInvite(invite: any) {
  if (!confirm(`撤销发给 ${invite.email} 的邀请？`)) return
  try { await api.revokeInvite(invite.id); await loadInvites() } catch (e: any) { alert(e?.message || '撤销失败') }
}
async function copy(text: string, tag: string) {
  try { await navigator.clipboard.writeText(text) } catch {
    const ta = document.createElement('textarea')
    ta.value = text; document.body.appendChild(ta); ta.select()
    document.execCommand('copy'); ta.remove()
  }
  copied.value = tag
  setTimeout(() => { if (copied.value === tag) copied.value = '' }, 1600)
}
function fmtExpire(iso?: string) {
  if (!iso) return '—'
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return '已过期'
  const hours = Math.floor(ms / 3600000)
  return hours >= 24 ? `${Math.floor(hours / 24)} 天后` : `${hours} 小时后`
}
function fmtTime(iso?: string) {
  if (!iso) return '从未'
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short', hour12: false }).format(new Date(iso))
}

/* ── 集成接入指引 ─────────────────────────────────────── */
const providerMeta: Record<string, { label: string; guide: string }> = {
  gitlab: { label: 'GitLab', guide: '在仓库 / 群组 Settings → Webhooks 中添加该 URL，触发事件按下方列表勾选。' },
  jenkins: { label: 'Jenkins', guide: '在流水线任务中配置该 URL 作为构建通知地址（POST JSON）。' },
  operations: { label: '运维信号', guide: '业务系统将事故 / 回滚 / 业务 SLI 信号 POST 到该地址，用于治理结果闭环。' },
}
const integrationRows = computed(() => {
  const source = integrations.value || {}
  return Object.entries(source).map(([key, v]: [string, any]) => ({
    key,
    meta: providerMeta[key] || { label: key, guide: '' },
    configured: v?.configured === true,
    endpoint: v?.endpoint || '',
    authentication: v?.authentication || '',
    events: Array.isArray(v?.supported_events) ? v.supported_events : [],
    last: v?.last_received_at || '',
  }))
})

/* ── 加载 ─────────────────────────────────────────────── */
async function load() {
  try { ent.value = await api.enterprise() } catch {}
  // /api/enterprise 不可用或返回为空时，退回会话里的组织信息，保证卡片有内容
  if (!ent.value?.name && auth.user) {
    ent.value = { name: auth.user.organization_name || '', id: auth.user.organization_id || '' }
  }
  integrations.value = ws.data?.integrationStatus || {}
  try { aiConfig.value = await api.request('/api/config/status') } catch {}
  await Promise.all([loadMembers(), loadInvites()])
}
async function save() {
  if (!ent.value) return
  saving.value = true
  try { await api.updateEnterprise({ name: ent.value.name }); await load() } catch (e: any) { alert(e?.message || '保存失败') }
  finally { saving.value = false }
}
onMounted(load)
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <div class="page-kicker mono">SYSTEM</div>
        <div class="page-title">系统设置</div>
        <div class="page-sub">外观 · 企业信息 · 成员与邀请 · 集成 · 账户</div>
      </div>
    </div>

    <!-- 偏好行：外观 / 企业信息 / AI 分析 / 账户 -->
    <div class="settings-grid">
      <article class="spanel">
        <h3><i></i>外观</h3>
        <p class="muted">界面配色会保存在本机，登录页与全景同步生效。</p>
        <div class="theme-seg">
          <button
            v-for="opt in themeOpts" :key="opt.k" type="button"
            :class="{ on: theme.pref.value === opt.k }"
            @click="theme.setPref(opt.k)"
          >{{ opt.label }}</button>
        </div>
      </article>

      <article class="spanel">
        <h3><i></i>企业信息</h3>
        <label class="sfield"><span>企业名称</span><input v-model="ent.name" placeholder="企业名称" /></label>
        <label class="sfield"><span>企业标识</span><span class="id-cell">{{ ent?.id || '—' }}</span></label>
        <label class="sfield"><span>我的角色</span><span>{{ auth.role }}</span></label>
        <NeonButton :loading="saving" @click="save"><TechIcon name="check-circle" :size="15" /> 保存</NeonButton>
      </article>

      <article class="spanel">
        <h3><i></i>模型分析</h3>
        <div v-if="aiConfig" class="kv-list">
          <div class="kv"><span>服务状态</span>
            <StatusBadge type="status" :value="aiConfig.llm_configured ? 'OK' : 'PENDING'" size="sm">
              {{ aiConfig.llm_configured ? '已配置' : '未配置' }}
            </StatusBadge>
          </div>
          <div class="kv"><span>供应商 / 模型</span><span class="mono">{{ aiConfig.llm_provider || '—' }} · {{ aiConfig.llm_model || '—' }}</span></div>
          <div class="kv"><span>每日限额</span><span class="mono">个人 {{ aiConfig.daily_analysis_limit }} 次 · 企业 {{ aiConfig.daily_organization_analysis_limit }} 次</span></div>
        </div>
        <p v-else class="muted">配置状态暂不可用，请刷新重试。</p>
        <p class="muted small">AI 分析用于变更单的风险解读与整改建议，额度由服务端配置控制。</p>
      </article>

      <article class="spanel">
        <h3><i></i>账户</h3>
        <div class="acct">
          <span class="acct-avatar">{{ (auth.user?.name || auth.user?.email || 'CG').slice(0, 2).toUpperCase() }}</span>
          <div><strong>{{ auth.user?.name || '操作员' }}</strong><br><span class="muted">{{ auth.user?.email || '—' }}</span></div>
        </div>
        <p v-if="auth.user?.enterprise_admin" class="muted small">你是企业管理员，可管理下方成员与邀请。</p>
      </article>
    </div>

    <!-- 集成接入指引 -->
    <section class="wide-panel">
      <header>
        <h3><i></i>集成接入</h3>
        <span class="muted small">把对应 Webhook 地址填到外部系统，事件到达后自动进入审计与结果闭环。</span>
      </header>
      <div v-if="integrationRows.length" class="int-grid">
        <div v-for="row in integrationRows" :key="row.key" class="int-card">
          <div class="int-head">
            <strong>{{ row.meta.label }}</strong>
            <StatusBadge type="status" :value="row.configured ? 'OK' : 'PENDING'" size="sm">
              {{ row.configured ? '已接入' : '待接入' }}
            </StatusBadge>
          </div>
          <div class="int-endpoint">
            <code class="mono ellipsis">{{ row.endpoint || '—' }}</code>
            <button v-if="row.endpoint" class="copy-btn" type="button" @click="copy(row.endpoint, row.key)">
              {{ copied === row.key ? '已复制' : '复制' }}
            </button>
          </div>
          <p v-if="row.meta.guide" class="muted small">{{ row.meta.guide }}</p>
          <div class="int-foot">
            <span v-if="row.events.length" class="muted small">事件：{{ row.events.join(' / ') }}</span>
            <span class="muted small">最近事件：{{ fmtTime(row.last) }}</span>
          </div>
        </div>
      </div>
      <p v-else class="muted">暂无集成状态数据。</p>
    </section>

    <!-- 成员与邀请（企业管理员可管理；其他人只读） -->
    <section class="wide-panel">
      <header>
        <h3><i></i>成员管理</h3>
        <span class="muted small">{{ members.length }} 名成员</span>
      </header>
      <div class="member-table" role="table">
        <div class="member-row member-head" role="row">
          <span>成员</span><span>角色</span><span>企业管理员</span><span>状态</span><span>最近登录</span>
        </div>
        <div v-for="m in members" :key="m.id" class="member-row" role="row">
          <span class="member-id">
            <span class="acct-avatar sm">{{ (m.name || m.email || 'C').slice(0, 2).toUpperCase() }}</span>
            <div><strong>{{ m.name || '未命名' }}</strong><br><small class="mono">{{ m.email || m.id }}</small></div>
          </span>
          <span>
            <select
              v-if="isAdmin" :value="m.role" class="role-select"
              :disabled="membersBusy[m.id]" @change="changeRole(m, ($event.target as HTMLSelectElement).value)"
            >
              <option v-for="r in ROLES" :key="r" :value="r">{{ r }}</option>
            </select>
            <template v-else>{{ m.role }}</template>
          </span>
          <span>
            <label v-if="isAdmin" class="switch" :class="{ disabled: membersBusy[m.id] }">
              <input type="checkbox" :checked="m.enterprise_admin === true" :disabled="membersBusy[m.id]" @change="toggleAdmin(m)" />
              <i></i>
            </label>
            <template v-else>{{ m.enterprise_admin ? '是' : '否' }}</template>
          </span>
          <span>
            <label v-if="isAdmin" class="switch" :class="{ disabled: membersBusy[m.id] }">
              <input type="checkbox" :checked="m.active !== false" :disabled="membersBusy[m.id]" @change="toggleActive(m)" />
              <i></i>
            </label>
            <template v-else>{{ m.active !== false ? '启用' : '停用' }}</template>
          </span>
          <span class="mono muted">{{ fmtTime(m.last_login_at) }}</span>
        </div>
        <p v-if="!members.length" class="muted empty-line">暂无成员记录</p>
      </div>
    </section>

    <section v-if="isAdmin" class="wide-panel">
      <header>
        <h3><i></i>邀请成员</h3>
        <span class="muted small">生成邀请链接发给同事，对方在登录页「邀请」页签完成加入。</span>
      </header>
      <div class="invite-form">
        <input v-model="inviteEmail" type="email" placeholder="对方企业邮箱" class="invite-input" />
        <select v-model="inviteRole" class="role-select">
          <option v-for="r in ROLES" :key="r" :value="r">{{ r }}</option>
        </select>
        <select v-model.number="inviteHours" class="role-select">
          <option :value="24">24 小时有效</option>
          <option :value="72">72 小时有效</option>
          <option :value="168">7 天有效</option>
          <option :value="720">30 天有效</option>
        </select>
        <NeonButton :loading="inviteBusy" @click="createInvite"><TechIcon name="arrow" :size="15" /> 生成邀请</NeonButton>
      </div>
      <div v-if="lastInviteLink" class="invite-link">
        <code class="mono ellipsis">{{ lastInviteLink }}</code>
        <button class="copy-btn" type="button" @click="copy(lastInviteLink, 'invite-link')">
          {{ copied === 'invite-link' ? '已复制' : '复制链接' }}
        </button>
      </div>
      <div v-if="invites.length" class="invite-table">
        <div class="member-row invite-head">
          <span>邮箱</span><span>角色</span><span>有效期</span><span>邀请人</span><span></span>
        </div>
        <div v-for="inv in invites" :key="inv.id" class="member-row">
          <span class="mono">{{ inv.email }}</span>
          <span>{{ inv.role }}</span>
          <span class="mono muted">{{ fmtExpire(inv.expires_at) }}</span>
          <span class="muted">{{ inv.created_by_name || '—' }}</span>
          <span class="row-action"><NeonButton variant="ghost" size="sm" @click="revokeInvite(inv)">撤销</NeonButton></span>
        </div>
      </div>
      <p v-else class="muted empty-line">暂无待处理邀请</p>
    </section>
  </div>
</template>

<style scoped>
@import './page.css';
.settings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--sp-3); align-content: start; align-items: start; margin-bottom: var(--sp-3); }
.spanel { padding: var(--sp-4); border-radius: var(--r-lg); background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow-card); display: flex; flex-direction: column; gap: var(--sp-3); }
:root[data-theme="light"] .spanel { box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6), var(--shadow-card); }
.spanel h3 { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--fs-14); color: var(--text-strong); font-weight: var(--fw-semibold); }
.spanel h3 i { width: 2px; height: 14px; background: var(--brand); border-radius: 1px; }
.sfield { display: flex; flex-direction: column; gap: var(--sp-1); font-size: var(--fs-12); color: var(--text-mute); }
.sfield input { height: 32px; padding: 0 var(--sp-3); border-radius: var(--r); background: var(--surface-2); border: 1px solid var(--line-strong); color: var(--text-strong); outline: none; font-size: var(--fs-13); }
.sfield input:focus { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-soft); background: var(--surface); }
.acct { display: flex; align-items: center; gap: var(--sp-3); }
.acct-avatar { width: 44px; height: 44px; border-radius: var(--r); display: grid; place-items: center; background: var(--brand-soft); color: var(--brand); font-weight: var(--fw-semibold); border: 1px solid var(--line-bright); flex: none; }
.acct-avatar.sm { width: 30px; height: 30px; font-size: var(--fs-11); }
.theme-seg { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0; padding: 3px; border: 1px solid var(--line); border-radius: var(--r); background: var(--surface-2); }
.theme-seg button { height: 28px; border-radius: var(--r-sm); border: 1px solid transparent; font-size: var(--fs-12); color: var(--text-mute); }
.theme-seg button.on { background: var(--surface); color: var(--text-strong); border: 1px solid var(--line); box-shadow: var(--shadow-soft); }

/* 通栏面板：成员 / 邀请 / 集成 */
.wide-panel { margin-bottom: var(--sp-3); padding: var(--sp-4); border-radius: var(--r-lg); background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow-card); }
:root[data-theme="light"] .wide-panel { box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6), var(--shadow-card); }
.wide-panel > header { display: flex; align-items: baseline; gap: var(--sp-3); flex-wrap: wrap; margin-bottom: var(--sp-3); }
.wide-panel h3 { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--fs-14); color: var(--text-strong); font-weight: var(--fw-semibold); }
.wide-panel h3 i { width: 2px; height: 14px; background: var(--brand); border-radius: 1px; }
.kv-list { display: flex; flex-direction: column; gap: var(--sp-2); }
.kv { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); font-size: var(--fs-13); }
.kv > span:first-child { color: var(--text-mute); }
.muted.small { font-size: var(--fs-12); }

/* 成员表 */
.member-table, .invite-table { display: flex; flex-direction: column; }
.member-row {
  display: grid; grid-template-columns: minmax(160px, 1.6fr) 120px 100px 80px minmax(90px, 1fr);
  align-items: center; gap: var(--sp-3); min-height: 46px; padding: 8px 0;
  border-bottom: 1px solid var(--line); font-size: var(--fs-13);
}
.invite-table .member-row { grid-template-columns: minmax(160px, 1.4fr) 110px 110px 110px 90px; }
.member-head { color: var(--text-faint); font-family: var(--font-mono); font-size: var(--fs-11); letter-spacing: 0.1em; text-transform: uppercase; min-height: 32px; }
.member-id { display: flex; align-items: center; gap: var(--sp-2); min-width: 0; }
.member-id strong { font-size: var(--fs-13); color: var(--text-strong); font-weight: var(--fw-medium); display: block; }
.member-id small { color: var(--text-faint); font-size: var(--fs-11); }
.role-select {
  height: 28px; padding: 0 6px; border-radius: var(--r); background: var(--surface-2);
  border: 1px solid var(--line-strong); color: var(--text-strong); font-size: var(--fs-12); outline: none;
}
.role-select:focus { border-color: var(--brand); }
.row-action { text-align: right; }
.empty-line { padding: var(--sp-3) 0; }
.mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* 开关 */
.switch { position: relative; display: inline-flex; align-items: center; }
.switch input { position: absolute; opacity: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; }
.switch i { width: 30px; height: 16px; border-radius: 999px; background: var(--line-strong); transition: background var(--dur-fast); }
.switch i::after { content: ''; position: absolute; left: 2px; top: 2px; width: 12px; height: 12px; border-radius: 999px; background: #fff; transition: transform var(--dur-fast); box-shadow: 0 1px 2px rgba(0,0,0,.2); }
.switch input:checked + i { background: var(--brand); }
.switch input:checked + i::after { transform: translateX(14px); }
.switch.disabled { opacity: .55; pointer-events: none; }

/* 邀请 */
.invite-form { display: flex; gap: var(--sp-2); flex-wrap: wrap; margin-bottom: var(--sp-3); }
.invite-form .invite-input { flex: 1 1 220px; height: 32px; padding: 0 var(--sp-3); border-radius: var(--r); background: var(--surface-2); border: 1px solid var(--line-strong); color: var(--text-strong); outline: none; font-size: var(--fs-13); }
.invite-form .invite-input:focus { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-soft); }
.invite-link {
  display: flex; align-items: center; gap: var(--sp-2); margin-bottom: var(--sp-3);
  padding: 8px var(--sp-3); border: 1px solid var(--line-bright); border-radius: var(--r);
  background: var(--brand-soft); font-size: var(--fs-12); color: var(--text-strong);
}
.copy-btn {
  flex: none; height: 24px; padding: 0 8px; border-radius: var(--r-sm);
  border: 1px solid var(--line-strong); background: var(--surface); color: var(--text-mute); font-size: var(--fs-11);
}
.copy-btn:hover { color: var(--brand-bright); border-color: var(--line-bright); }

/* 集成卡 */
.int-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--sp-3); }
.int-card { border: 1px solid var(--line); border-radius: var(--r); padding: var(--sp-3); display: flex; flex-direction: column; gap: var(--sp-2); background: var(--bg-base); }
:root[data-theme="dark"] .int-card { background: var(--surface-2); }
.int-head { display: flex; align-items: center; justify-content: space-between; }
.int-head strong { font-size: var(--fs-13); color: var(--text-strong); }
.int-endpoint { display: flex; align-items: center; gap: var(--sp-2); min-width: 0; }
.int-endpoint code { flex: 1; font-size: var(--fs-11); color: var(--brand-bright); background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 4px 6px; }
.int-foot { display: flex; flex-direction: column; gap: 2px; }

@media (max-width: 980px) {
  .member-row { grid-template-columns: 1fr 110px; }
  .member-row.member-head, .member-row .int-foot { display: none; }
  .invite-table .member-row { grid-template-columns: 1fr 90px; }
  .trend-grid { grid-template-columns: 1fr; }
}
</style>
