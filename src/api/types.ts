/* 核心领域类型 —— 与后端 API 契约对齐（源自 api-adapter.js 归纳） */

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN'
export type ChangeStatus =
  | 'DRAFT' | 'CHECKING' | 'CHECK_FAILED' | 'READY_FOR_EXPERIMENT'
  | 'EXPERIMENT_QUEUED' | 'EXPERIMENT_RUNNING' | 'WAITING_APPROVAL'
  | 'APPROVED' | 'COMPLETED' | 'REJECTED'
export type EvidenceState = 'REAL' | 'NOT_RUN' | 'FAILED' | 'DEMO_ONLY'
export type PassportState = 'ACTIVE' | 'EXPIRED' | 'CONSUMED' | 'UNUSED' | 'REVOKED' | 'UNKNOWN'

export interface User { id: string; name?: string; email?: string; role?: string; status?: string; [k: string]: any }
export interface App { id: string; name: string; code?: string; env?: string; status?: string; [k: string]: any }
export interface Policy { id: string; title: string; enabled: boolean; severity?: string; [k: string]: any }
export interface Audit { id: string; action?: string; actor?: string; at?: string; [k: string]: any }
export interface Finding { id?: string; code?: string; title?: string; severity?: RiskLevel; [k: string]: any }
export interface Artifact { kind?: string; [k: string]: any }

export interface Passport {
  available: boolean
  state?: string
  exists?: boolean
  id?: string
  changeId?: string
  status?: string
  digest?: string
  environment?: string
  approver?: string
  issuedAt?: string
  expiresAt?: string
  consumedAt?: string
  consumeState?: string
  revokedAt?: string
  evidenceState?: string
  verifyPath?: string
}

export interface Change {
  id: string
  title?: string
  status: ChangeStatus
  risk: RiskLevel
  application_id?: string
  application_name?: string
  owner?: string
  owner_name?: string
  reviewer_name?: string
  created_at?: string
  updated_at?: string
  summary?: string
  sql?: string
  artifacts?: Artifact[]
  findings?: Finding[]
  timeline?: any[]
  comments?: any[]
  evidence_state?: EvidenceState
  passport?: Passport
  risk_score?: number | null
  experiment?: any
  check_run?: any
  [k: string]: any
}

export interface Dashboard {
  total_changes?: number
  pending_approvals?: number
  open_risks?: number
  compliance_rate?: number
  trends?: any[]
  [k: string]: any
}

export interface AgentCitation { kind?: string; id?: string; title?: string; summary?: string; [k: string]: any }
export interface AgentTrace { tool?: string; input?: string; output?: string; error?: string; [k: string]: any }
export interface AgentProposal { type?: string; title?: string; [k: string]: any }
export interface AgentMessage {
  id: string
  conversation_id?: string
  question?: string
  answer?: string
  content?: string
  citations?: AgentCitation[]
  trace?: AgentTrace[]
  proposals?: AgentProposal[]
  created_at?: string
  [k: string]: any
}
export interface AgentConversationSummary { conversation?: any; messages?: AgentMessage[]; [k: string]: any }

export interface Workspace {
  dashboard: Dashboard | null
  apps: App[]
  users: User[]
  changes: Change[]
  policies: Policy[]
  audits: Audit[]
  config: any
  passports: any
  conflicts: any
  integrationStatus: any
  integrationEvents: any[]
}

export interface SessionUser { id?: string; name?: string; email?: string; role?: string }
export interface Session { user?: SessionUser; csrf_token?: string; enterprise?: any; [k: string]: any }
