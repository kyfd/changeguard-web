/* ChangeGuard API Client —— TS 化复用 api-adapter.js 的契约与归一化逻辑
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

function listFrom<T>(value: any, keys: string[] = []): T[] {
  if (Array.isArray(value)) return value
  for (const k of keys) if (Array.isArray(value?.[k])) return value[k]
  return []
}

function evidenceState(change: any): Change['evidence_state'] {
  const explicit = change?.evidence_state || change?.validation_state || change?.experiment?.evidence_state
  const s = explicit ? String(explicit).toUpperCase() : ''
  const report = change?.experiment || change?.validation_report
  const status = String(report?.status || '').toUpperCase()
  const mode = String(report?.mode || '').toUpperCase()
  if (s === 'FAILED' || status === 'FAILED') return 'FAILED'
  if (s === 'DEMO_ONLY' || mode.includes('SIMULATED') || mode.includes('DEMO')) return 'DEMO_ONLY'
  const kinds = Array.isArray(change?.artifacts) ? change.artifacts.map((i: any) => String(i?.kind || '').toUpperCase()) : []
  const dbChange = Boolean(String(change?.sql || '').trim()) || kinds.includes('DATABASE')
  if (dbChange) return status === 'PASSED' && mode === 'POSTGRES' && report?.rollback_verified === true ? 'REAL' : 'NOT_RUN'
  const check = change?.check_run || change?.checkRun
  const checkPassed = String(check?.status || '').toUpperCase() === 'PASSED' && Number(check?.blocking || 0) === 0
  if (checkPassed && check?.artifact_sha256 && check?.rule_set_version) return 'REAL'
  return s === 'REAL' ? 'REAL' : 'NOT_RUN'
}

function normalizePassport(raw: any, change: any): Passport {
  const p = raw || change?.passport || change?.gate_passport || change?.change_passport || null
  if (!p) return { available: false, state: 'NOT_RUN' }
  let status = String(p.status || p.state || 'UNKNOWN').toUpperCase()
  const expiresAt = p.expires_at || ''
  if (status === 'ACTIVE' && expiresAt && new Date(expiresAt).getTime() <= Date.now()) status = 'EXPIRED'
  const consumeState = String(p.consume_state || p.consumption_status || (p.consumed_at ? 'CONSUMED' : 'UNUSED')).toUpperCase()
  return {
    exists: true,
    available: status === 'ACTIVE',
    id: p.id || p.passport_id || p.token_id || '',
    changeId: p.change_id || p.aggregate_id || change?.id || '',
    status, state: status,
    digest: p.artifact_sha256 || p.digest || p.content_digest || p.sha256 || '',
    environment: p.environment || p.target_environment || change?.environment || '',
    approver: p.approver_name || p.approver || change?.reviewer_name || '',
    issuedAt: p.issued_at || p.created_at || '',
    expiresAt, consumedAt: p.consumed_at || '',
    consumeState,
    revokedAt: p.revoked_at || '',
    evidenceState: String(p.evidence_state || evidenceState(change)).toUpperCase(),
    verifyPath: p.verify_path || p.verify_endpoint || '',
  }
}

export function normalizeChange(change: any): Change {
  const artifacts = Array.isArray(change?.artifacts) ? change.artifacts : []
  return {
    ...change,
    risk: (String(change?.risk || 'UNKNOWN').toUpperCase()) as Change['risk'],
    status: (String(change?.status || 'DRAFT').toUpperCase()) as Change['status'],
    artifacts,
    findings: Array.isArray(change?.findings) ? change.findings : [],
    timeline: Array.isArray(change?.timeline) ? change.timeline : [],
    comments: Array.isArray(change?.comments) ? change.comments : [],
    evidence_state: evidenceState(change),
    passport: normalizePassport(null, change),
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

async function optional<T = any>(paths: string[]): Promise<{ supported: boolean; path: string; data: T | null }> {
  for (const p of paths) {
    try { return { supported: true, path: p, data: await request<T>(p) } }
    catch (e: any) { if (e.status !== 404 && e.status !== 405) throw e }
  }
  return { supported: false, path: '', data: null }
}

async function soft<T = any>(path: string, fallback: T): Promise<T> {
  try { return await request<T>(path) }
  catch (e: any) { if (e.status === 401) throw e; return fallback }
}

async function loadPassports(changes: Change[]) {
  const globalResult = await optional(['/api/passports', '/api/gate/passports', '/api/ci/passports'])
  if (globalResult.supported && globalResult.data) {
    const raw: any = globalResult.data
    const items: any[] = listFrom(raw, ['passports', 'items', 'data'])
    const byChange = new Map(changes.map(c => [c.id, c]))
    return { supported: true, path: globalResult.path, items: items.map(i => normalizePassport(i, byChange.get(i.change_id || i.aggregate_id))) }
  }
  const rows = await Promise.all(changes.map(async c => {
    try {
      const r = await optional([`/api/changes/${encodeURIComponent(c.id)}/passports`])
      if (!r.supported) return { supported: false, items: [] as Passport[] }
      return { supported: true, items: listFrom(r.data, ['passports', 'items', 'data']).map((i: any) => normalizePassport(i, c)) }
    } catch (e: any) {
      if (e?.status === 401) throw e
      return { supported: true, items: [] as Passport[] }
    }
  }))
  const items = rows.flatMap(r => r.items)
  const supported = rows.some(r => r.supported)
  return { supported, path: supported ? '/api/changes/{id}/passports' : '', items }
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
  changes: async (): Promise<Change[]> => listFrom<any>(await request('/api/changes'), ['changes', 'items']).map(normalizeChange),
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
  operations: () => optional(['/api/operations/outbox']),
  conflicts: () => soft('/api/conflicts', null),
  integrationStatus: () => soft('/api/integrations/status', {}),
  integrationEvents: (limit = 100) => soft(`/api/integrations/events?limit=${encodeURIComponent(limit)}`, []),

  // 门禁护照
  issuePassport: (id: string) => request(`/api/changes/${encodeURIComponent(id)}/passports`, { method: 'POST', body: '{}' }),
  revokePassport: (cid: string, pid: string) => request(`/api/changes/${encodeURIComponent(cid)}/passports/${encodeURIComponent(pid)}/revoke`, { method: 'POST', body: '{}' }),
  gateMetadata: () => optional(['/api/gate/metadata']),
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

  // 一次性加载工作区全量数据
  async loadWorkspace(): Promise<Workspace> {
    const changes = await this.changes()
    const unavailableSources: string[] = []
    async function snapshotSource<T>(source: string, path: string, fallback: T): Promise<T> {
      try { return await request<T>(path) }
      catch (error) {
        if (error instanceof APIError && error.status === 401) throw error
        unavailableSources.push(source)
        return fallback
      }
    }
    const [dashboard, apps, users, policies, audits, config, conflicts, integrationStatus, integrationEvents] = await Promise.all([
      snapshotSource<Dashboard | null>('dashboard', '/api/dashboard', null),
      snapshotSource<Workspace['apps']>('apps', '/api/apps', []), snapshotSource<Workspace['users']>('users', '/api/users', []),
      snapshotSource<Policy[]>('policies', '/api/policies', []), snapshotSource<Workspace['audits']>('audits', '/api/audits?limit=250', []),
      snapshotSource<Workspace['config']>('config', '/api/config/status', null), snapshotSource<Workspace['conflicts']>('conflicts', '/api/conflicts', null),
      snapshotSource<Workspace['integrationStatus']>('integrationStatus', '/api/integrations/status', {}),
      snapshotSource<Workspace['integrationEvents']>('integrationEvents', '/api/integrations/events?limit=100', []),
    ])
    const passportBundle = await loadPassports(changes as Change[])
    const byChange = new Map<string, Passport>()
    ;[...passportBundle.items].sort((a, b) => new Date(a.issuedAt || 0).getTime() - new Date(b.issuedAt || 0).getTime()).forEach(it => {
      const key = it.changeId || ''
      const cur = byChange.get(key)
      if (!cur || it.available || !cur.available) byChange.set(key, it)
    })
    const normalizedChanges = (changes as Change[]).map(c => {
      const p = byChange.get(c.id)
      return p ? { ...c, passport: p } : c
    })
    return {
      unavailableSources: unavailableSources.sort(),
      dashboard, apps: apps || [], users: users || [], changes: normalizedChanges,
      policies: policies || [], audits: audits || [], config, passports: passportBundle,
      conflicts, integrationStatus: integrationStatus || {}, integrationEvents: listFrom(integrationEvents, ['events', 'items', 'data']),
    }
  },
}
