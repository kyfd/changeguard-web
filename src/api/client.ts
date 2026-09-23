/* ChangeGuard API Client —— 字段名与后端 internal/model 的 JSON tag 一一对应
   认证：same-origin cookie + CSRF token + X-Actor-ID */
import type { AgentConversationSummary, AgentMessage, Change, Dashboard, Policy, Passport, Session, Workspace } from './types'

const ACTOR_KEY = 'changeguard_actor'
let csrfToken = ''
let actorId = localStorage.getItem(ACTOR_KEY) || ''

export class APIError extends Error {
  status: number
  payload: any
  constructor(message: string, status: number, payload: any) {
    super(message || '请求失败')
    this.name = 'APIError'
    this.status = status
    this.payload = payload
  }
}

export function setSession(session: Session | null) {
  csrfToken = session?.csrf_token || ''
  if (session?.user?.id) {
    actorId = session.user.id
    localStorage.setItem(ACTOR_KEY, actorId)
  } else {
    actorId = ''
    localStorage.removeItem(ACTOR_KEY)
  }
}

/* 后端不输出 evidence_state（model.ChangeRequest 无此字段），按实验报告 / 检查运行推导。 */
function evidenceState(change: any): Change['evidence_state'] {
  const report = change?.experiment
  const status = String(report?.status || '').toUpperCase()
  const mode = String(report?.mode || '').toUpperCase()
  if (status === 'FAILED') return 'FAILED'
  if (mode.includes('SIMULATED') || mode.includes('DEMO')) return 'DEMO_ONLY'
  const kinds = Array.isArray(change?.artifacts) ? change.artifacts.map((i: any) => String(i?.kind || '').toUpperCase()) : []
  const dbChange = Boolean(String(change?.sql || '').trim()) || kinds.includes('DATABASE')
  if (dbChange) return status === 'PASSED' && mode === 'POSTGRES' && report?.rollback_verified === true ? 'REAL' : 'NOT_RUN'
  const check = change?.check_run
  const checkPassed = String(check?.status || '').toUpperCase() === 'PASSED' && Number(check?.blocking || 0) === 0
  if (checkPassed && check?.artifact_sha256 && check?.rule_set_version) return 'REAL'
  return 'NOT_RUN'
}

/* p 为 model.Passport；change 仅用于推导证据状态。 */
function normalizePassport(p: any, change: any): Passport {
  let status = String(p.status || 'UNKNOWN').toUpperCase()
  const expiresAt = p.expires_at || ''
  if (status === 'ACTIVE' && expiresAt && new Date(expiresAt).getTime() <= Date.now()) status = 'EXPIRED'
  return {
    exists: true,
    available: status === 'ACTIVE',
    id: p.id || '',
    changeId: p.change_id || '',
    status, state: status,
    digest: p.artifact_sha256 || '',
    environment: p.environment || '',
    approver: p.approver_name || '',
    issuedAt: p.issued_at || '',
    expiresAt, consumedAt: p.consumed_at || '',
    consumeState: p.consumed_at ? 'CONSUMED' : 'UNUSED',
    revokedAt: p.revoked_at || '',
    evidenceState: String(evidenceState(change)).toUpperCase(),
  }
}

export function normalizeChange(change: any): Change {
  return {
    ...change,
    risk: (String(change?.risk || 'UNKNOWN').toUpperCase()) as Change['risk'],
    status: (String(change?.status || 'DRAFT').toUpperCase()) as Change['status'],
    artifacts: Array.isArray(change?.artifacts) ? change.artifacts : [],
    findings: Array.isArray(change?.findings) ? change.findings : [],
    timeline: Array.isArray(change?.timeline) ? change.timeline : [],
    comments: Array.isArray(change?.comments) ? change.comments : [],
    evidence_state: evidenceState(change),
    // ChangeRequest 不内嵌护照；真实护照由 loadWorkspace 从 /api/passports 合并。
    passport: { available: false, state: 'NOT_RUN' },
    risk_score: Number.isFinite(Number(change?.risk_score)) ? Number(change.risk_score) : null,
  }
}

async function request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...(options.headers as Record<string, string> || {}) }
  if (options.body != null && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json'
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken
  if (actorId) headers['X-Actor-ID'] = actorId
  const res = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...options, headers })
  const ct = res.headers.get('content-type') || ''
  let payload: any = null
  if (res.status !== 204) {
    if (ct.includes('json')) payload = await res.json().catch(() => null)
    else payload = await res.text().catch(() => '')
  }
  if (!res.ok) {
    const msg = payload?.error || payload?.message || (typeof payload === 'string' && payload) || `请求失败（HTTP ${res.status}）`
    throw new APIError(msg, res.status, payload)
  }
  return payload as T
}

/* soft 调用失败的记录去向：传入 errors 时写入该数组（loadWorkspace 按次收集），
   否则交给全局监听（workspace store 注册）。401 仍然抛出。
   403 是角色权限的预期结果（如非管理员读取集成状态），不视为故障，只打 debug。 */
type SoftErrorListener = (entry: string) => void
let softErrorListener: SoftErrorListener | null = null
export function onSoftError(fn: SoftErrorListener | null) { softErrorListener = fn }

async function soft<T = any>(path: string, fallback: T, errors?: string[]): Promise<T> {
  try { return await request<T>(path) }
  catch (e: any) {
    if (e?.status === 401) throw e
    if (e?.status === 403) { console.debug(`[soft] ${path} 无权限，使用空数据`); return fallback }
    const entry = `${path}: ${e?.message || String(e)}`
    console.warn(`[soft] 加载失败，已使用空数据 —— ${entry}`)
    if (errors) errors.push(entry)
    else softErrorListener?.(entry)
    return fallback
  }
}

export const api = {
  request,
  setSession,
  normalizeChange,
  evidenceState,

  // 认证
  authStatus: () => request('/api/auth/status'),
  session: () => request<Session>('/api/auth/session'),
  login: (p: any) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(p) }),
  register: (p: any) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(p) }),
  acceptInvite: (p: any) => request('/api/auth/invitations/accept', { method: 'POST', body: JSON.stringify(p) }),
  // 后端退出后重定向首页，接受 HTML 使开发服务器也能处理该跳转。
  logout: () => request('/auth/logout', { method: 'POST', headers: { Accept: 'text/html' }, body: '{}' }),

  // 核心
  dashboard: () => request<Dashboard>('/api/dashboard'),
  trends: (months = 6) => request<any[]>(`/api/governance/trends?months=${months}`),
  apps: () => request('/api/apps'),
  users: () => request('/api/users'),
  // 不带分页参数时 /api/changes 直接返回数组
  changes: async (): Promise<Change[]> => {
    const raw = await request<any[]>('/api/changes')
    return (Array.isArray(raw) ? raw : []).map(normalizeChange)
  },
  change: async (id: string) => normalizeChange(await request(`/api/changes/${encodeURIComponent(id)}`)),
  askChangeAssistant: (id: string, question: string, conversationId = '') => request<AgentMessage>(`/api/changes/${encodeURIComponent(id)}/agent-ask`, {
    method: 'POST', body: JSON.stringify({ question, ...(conversationId ? { conversation_id: conversationId } : {}) }),
  }),
  agentConversations: (id: string) => request<any>(`/api/changes/${encodeURIComponent(id)}/agent-conversations`),
  agentConversation: (id: string, conversationId: string) => request<AgentConversationSummary>(`/api/changes/${encodeURIComponent(id)}/agent-conversations/${encodeURIComponent(conversationId)}`),
  createChange: (p: any) => request('/api/changes', { method: 'POST', body: JSON.stringify(p) }),
  updateChange: (id: string, p: any) => request(`/api/changes/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(p) }),
  changeAction: (id: string, action: string, p: any = {}) => request(`/api/changes/${encodeURIComponent(id)}/${action}`, { method: 'POST', body: JSON.stringify(p) }),
  findingAction: (cid: string, fid: string, action: string, p?: any) => request(`/api/changes/${encodeURIComponent(cid)}/findings/${encodeURIComponent(fid)}/${action}`, { method: 'POST', body: JSON.stringify(p || {}) }),

  // 策略
  policies: () => request<Policy[]>('/api/policies'),
  createPolicy: (p: any) => request('/api/policies', { method: 'POST', body: JSON.stringify(p) }),
  updatePolicy: (id: string, p: any) => request(`/api/policies/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(p) }),
  togglePolicy: (id: string) => request(`/api/policies/${encodeURIComponent(id)}/toggle`, { method: 'POST', body: '{}' }),
  testPolicies: (p: any) => request('/api/policies/test', { method: 'POST', body: JSON.stringify(p) }),

  // 运维
  audits: (limit = 250) => request(`/api/audits?limit=${encodeURIComponent(limit)}`),
  config: () => request('/api/config/status'),
  operations: () => request('/api/operations/outbox'),
  conflicts: () => soft('/api/conflicts', null),
  integrationStatus: () => soft('/api/integrations/status', {}),
  integrationEvents: async (limit = 100) => (await soft<any>(`/api/integrations/events?limit=${encodeURIComponent(limit)}`, null))?.events || [],

  // 门禁护照
  issuePassport: (id: string) => request(`/api/changes/${encodeURIComponent(id)}/passports`, { method: 'POST', body: '{}' }),
  revokePassport: (cid: string, pid: string) => request(`/api/changes/${encodeURIComponent(cid)}/passports/${encodeURIComponent(pid)}/revoke`, { method: 'POST', body: '{}' }),
  gateVerify: (p: any) => request('/api/gate/verify', { method: 'POST', body: JSON.stringify(p) }),
  gateConsume: (p: any) => request('/api/gate/consume', { method: 'POST', body: JSON.stringify(p) }),

  // 企业
  enterprise: () => request('/api/enterprise'),
  updateEnterprise: (p: any) => request('/api/enterprise', { method: 'PUT', body: JSON.stringify(p) }),
  enterpriseMembers: () => request('/api/enterprise/members'),
  updateMember: (id: string, p: any) => request(`/api/enterprise/members/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(p) }),
  enterpriseInvites: () => request('/api/enterprise/invites'),
  createInvite: (p: any) => request('/api/enterprise/invites', { method: 'POST', body: JSON.stringify(p) }),
  revokeInvite: (id: string) => request(`/api/enterprise/invites/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // 企业模型接入（Key 只写不读，后端仅返回 api_key_hint）
  llmConfig: () => request('/api/enterprise/llm'),
  saveLLMConfig: (p: any) => request('/api/enterprise/llm', { method: 'PUT', body: JSON.stringify(p) }),
  testLLM: (p: any) => request<{ ok: boolean; message: string }>('/api/enterprise/llm/test', { method: 'POST', body: JSON.stringify(p) }),
  listLLMModels: (p: any) => request<{ models: any[] }>('/api/enterprise/llm/models', { method: 'POST', body: JSON.stringify(p) }),
  llmPresets: () => soft<any[]>('/api/enterprise/llm/presets', []),
  llmUsage: () => soft<any>('/api/enterprise/llm/usage', null),

  /* 一次性加载工作区全量数据。/api/changes 失败直接抛出（工作区不可用）；
     其余接口失败降级为空数据，并把 "接口: 原因" 写入 errors。 */
  async loadWorkspace(errors: string[] = []): Promise<Workspace> {
    const [changes, dashboard, apps, users, policies, audits, config, conflicts, integrationStatus, integrationEvents, rawPassports] = await Promise.all([
      this.changes(),
      soft<Dashboard | null>('/api/dashboard', null, errors), soft<any[]>('/api/apps', [], errors), soft<any[]>('/api/users', [], errors),
      soft<Policy[]>('/api/policies', [], errors), soft<any[]>('/api/audits?limit=250', [], errors), soft<any>('/api/config/status', null, errors),
      soft<any>('/api/conflicts', null, errors), soft<any>('/api/integrations/status', {}, errors),
      soft<any>('/api/integrations/events?limit=100', null, errors),
      soft<any[] | null>('/api/passports', null, errors),
    ])
    // /api/passports 返回 []model.Passport（已按操作者可见范围过滤）
    const byId = new Map(changes.map(c => [c.id, c]))
    const passportItems = (Array.isArray(rawPassports) ? rawPassports : []).map(p => normalizePassport(p, byId.get(p?.change_id)))
    const byChange = new Map<string, Passport>()
    ;[...passportItems].sort((a, b) => new Date(a.issuedAt || 0).getTime() - new Date(b.issuedAt || 0).getTime()).forEach(it => {
      const key = it.changeId || ''
      const cur = byChange.get(key)
      if (!cur || it.available || !cur.available) byChange.set(key, it)
    })
    const normalizedChanges = changes.map(c => {
      const p = byChange.get(c.id)
      return p ? { ...c, passport: p } : c
    })
    return {
      dashboard, apps: apps || [], users: users || [], changes: normalizedChanges,
      policies: policies || [], audits: audits || [], config,
      passports: { supported: rawPassports !== null, path: '/api/passports', items: passportItems },
      conflicts, integrationStatus: integrationStatus || {},
      integrationEvents: Array.isArray(integrationEvents?.events) ? integrationEvents.events : [],
    }
  },
}
