/* ChangeGuard API Client
   认证：same-origin cookie + CSRF token + X-Actor-ID */
import type {
  AgentConversationSummary,
  AgentMessage,
  Change,
  Dashboard,
  Passport,
  Policy,
  Session,
  Workspace,
} from './types'
import {
  evidenceState,
  listFrom,
  normalizeChange,
  normalizePassport,
} from './normalizers.ts'
import {
  APIError,
  loadPassports,
  onSoftError,
  optional,
  request,
  setSession,
  soft,
} from './core.ts'

export { APIError, setSession, normalizeChange, evidenceState, normalizePassport, listFrom, onSoftError }

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
  changes: async (): Promise<Change[]> =>
    listFrom<any>(await request('/api/changes'), ['changes', 'items']).map(normalizeChange),
  change: async (id: string) => normalizeChange(await request(`/api/changes/${encodeURIComponent(id)}`)),
  askChangeAssistant: (id: string, question: string, conversationId = '') =>
    request<AgentMessage>(`/api/changes/${encodeURIComponent(id)}/agent-ask`, {
      method: 'POST',
      body: JSON.stringify({ question, ...(conversationId ? { conversation_id: conversationId } : {}) }),
    }),
  agentConversations: (id: string) => request<any>(`/api/changes/${encodeURIComponent(id)}/agent-conversations`),
  agentConversation: (id: string, conversationId: string) =>
    request<AgentConversationSummary>(
      `/api/changes/${encodeURIComponent(id)}/agent-conversations/${encodeURIComponent(conversationId)}`
    ),
  createChange: (p: any) => request('/api/changes', { method: 'POST', body: JSON.stringify(p) }),
  updateChange: (id: string, p: any) =>
    request(`/api/changes/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(p) }),
  changeAction: (id: string, action: string, p: any = {}) =>
    request(`/api/changes/${encodeURIComponent(id)}/${action}`, { method: 'POST', body: JSON.stringify(p) }),
  findingAction: (cid: string, fid: string, action: string, p?: any) =>
    request(`/api/changes/${encodeURIComponent(cid)}/findings/${encodeURIComponent(fid)}/${action}`, {
      method: 'POST',
      body: JSON.stringify(p || {}),
    }),

  // 策略
  policies: () => request<Policy[]>('/api/policies'),
  createPolicy: (p: any) => request('/api/policies', { method: 'POST', body: JSON.stringify(p) }),
  updatePolicy: (id: string, p: any) =>
    request(`/api/policies/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(p) }),
  togglePolicy: (id: string) =>
    request(`/api/policies/${encodeURIComponent(id)}/toggle`, { method: 'POST', body: '{}' }),
  testPolicies: (p: any) => request('/api/policies/test', { method: 'POST', body: JSON.stringify(p) }),

  // 运维
  audits: (limit = 250) => request(`/api/audits?limit=${encodeURIComponent(limit)}`),
  config: () => request('/api/config/status'),
  operations: () => optional(['/api/operations/outbox']),
  conflicts: () => soft('/api/conflicts', null),
  integrationStatus: () => soft('/api/integrations/status', {}),
  integrationEvents: (limit = 100) => soft(`/api/integrations/events?limit=${encodeURIComponent(limit)}`, []),

  // 门禁护照
  issuePassport: (id: string) =>
    request(`/api/changes/${encodeURIComponent(id)}/passports`, { method: 'POST', body: '{}' }),
  revokePassport: (cid: string, pid: string) =>
    request(`/api/changes/${encodeURIComponent(cid)}/passports/${encodeURIComponent(pid)}/revoke`, {
      method: 'POST',
      body: '{}',
    }),
  gateMetadata: () => optional(['/api/gate/metadata']),
  gateVerify: (p: any) => request('/api/gate/verify', { method: 'POST', body: JSON.stringify(p) }),
  gateConsume: (p: any) => request('/api/gate/consume', { method: 'POST', body: JSON.stringify(p) }),

  // 企业
  enterprise: () => request('/api/enterprise'),
  updateEnterprise: (p: any) => request('/api/enterprise', { method: 'PUT', body: JSON.stringify(p) }),
  enterpriseMembers: () => request('/api/enterprise/members'),
  updateMember: (id: string, p: any) =>
    request(`/api/enterprise/members/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(p) }),
  enterpriseInvites: () => request('/api/enterprise/invites'),
  createInvite: (p: any) => request('/api/enterprise/invites', { method: 'POST', body: JSON.stringify(p) }),
  revokeInvite: (id: string) =>
    request(`/api/enterprise/invites/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // 企业模型接入
  llmConfig: () => request('/api/enterprise/llm'),
  saveLLMConfig: (p: any) => request('/api/enterprise/llm', { method: 'PUT', body: JSON.stringify(p) }),
  testLLM: (p: any) => request<{ ok: boolean; message: string }>('/api/enterprise/llm/test', { method: 'POST', body: JSON.stringify(p) }),
  listLLMModels: (p: any) => request<{ models: any[] }>('/api/enterprise/llm/models', { method: 'POST', body: JSON.stringify(p) }),
  llmPresets: () => soft<any[]>('/api/enterprise/llm/presets', []),
  llmUsage: () => soft<any>('/api/enterprise/llm/usage', null),

  // 一次性加载工作区全量数据
  async loadWorkspace(errors: string[] = []): Promise<Workspace> {
    const changes = await this.changes()
    const unavailableSources: string[] = []
    async function snapshotSource<T>(source: string, path: string, fallback: T): Promise<T> {
      try {
        return await request<T>(path)
      } catch (error) {
        if (error instanceof APIError && error.status === 401) throw error
        unavailableSources.push(source)
        return fallback
      }
    }
    const [dashboard, apps, users, policies, audits, config, conflicts, integrationStatus, integrationEvents] =
      await Promise.all([
        snapshotSource<Dashboard | null>('dashboard', '/api/dashboard', null),
        snapshotSource<Workspace['apps']>('apps', '/api/apps', []),
        snapshotSource<Workspace['users']>('users', '/api/users', []),
        snapshotSource<Policy[]>('policies', '/api/policies', []),
        snapshotSource<Workspace['audits']>('audits', '/api/audits?limit=250', []),
        snapshotSource<Workspace['config']>('config', '/api/config/status', null),
        snapshotSource<Workspace['conflicts']>('conflicts', '/api/conflicts', null),
        snapshotSource<Workspace['integrationStatus']>('integrationStatus', '/api/integrations/status', {}),
        snapshotSource<Workspace['integrationEvents']>(
          'integrationEvents',
          '/api/integrations/events?limit=100',
          []
        ),
      ])
    const passportBundle = await loadPassports(changes as Change[])
    const byChange = new Map<string, Passport>()
    ;[...passportBundle.items]
      .sort((a, b) => new Date(a.issuedAt || 0).getTime() - new Date(b.issuedAt || 0).getTime())
      .forEach((it) => {
        const key = it.changeId || ''
        const cur = byChange.get(key)
        if (!cur || it.available || !cur.available) byChange.set(key, it)
      })
    const normalizedChanges = (changes as Change[]).map((c) => {
      const p = byChange.get(c.id)
      return p ? { ...c, passport: p } : c
    })
    return {
      unavailableSources: unavailableSources.sort(),
      dashboard,
      apps: apps || [],
      users: users || [],
      changes: normalizedChanges,
      policies: policies || [],
      audits: audits || [],
      config,
      passports: passportBundle,
      conflicts,
      integrationStatus: integrationStatus || {},
      integrationEvents: listFrom(integrationEvents, ['events', 'items', 'data']),
    }
  },
}
