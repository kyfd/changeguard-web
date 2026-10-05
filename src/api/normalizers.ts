import type { Change, Passport } from './types'

export function listFrom<T>(value: any, keys: string[] = []): T[] {
  if (Array.isArray(value)) return value
  for (const k of keys) {
    if (Array.isArray(value?.[k])) return value[k]
  }
  return []
}

export function evidenceState(change: any): Change['evidence_state'] {
  const explicit = change?.evidence_state || change?.validation_state || change?.experiment?.evidence_state
  const s = explicit ? String(explicit).toUpperCase() : ''
  const report = change?.experiment || change?.validation_report
  const status = String(report?.status || '').toUpperCase()
  const mode = String(report?.mode || '').toUpperCase()

  if (s === 'FAILED' || status === 'FAILED') return 'FAILED'
  if (s === 'DEMO_ONLY' || mode.includes('SIMULATED') || mode.includes('DEMO')) return 'DEMO_ONLY'

  const kinds = Array.isArray(change?.artifacts)
    ? change.artifacts.map((i: any) => String(i?.kind || '').toUpperCase())
    : []
  const dbChange = Boolean(String(change?.sql || '').trim()) || kinds.includes('DATABASE')
  if (dbChange) {
    return status === 'PASSED' && mode === 'POSTGRES' && report?.rollback_verified === true ? 'REAL' : 'NOT_RUN'
  }

  const check = change?.check_run || change?.checkRun
  const checkPassed = String(check?.status || '').toUpperCase() === 'PASSED' && Number(check?.blocking || 0) === 0
  if (checkPassed && check?.artifact_sha256 && check?.rule_set_version) {
    return 'REAL'
  }

  return s === 'REAL' ? 'REAL' : 'NOT_RUN'
}

export function normalizePassport(raw: any, change: any): Passport {
  const p = raw || change?.passport || change?.gate_passport || change?.change_passport || null
  if (!p) return { available: false, state: 'NOT_RUN' }

  let status = String(p.status || p.state || 'UNKNOWN').toUpperCase()
  const expiresAt = p.expires_at || ''
  if (status === 'ACTIVE' && expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    status = 'EXPIRED'
  }

  const consumeState = String(
    p.consume_state || p.consumption_status || (p.consumed_at ? 'CONSUMED' : 'UNUSED')
  ).toUpperCase()

  return {
    exists: true,
    available: status === 'ACTIVE',
    id: p.id || p.passport_id || p.token_id || '',
    changeId: p.change_id || p.aggregate_id || change?.id || '',
    status,
    state: status,
    digest: p.artifact_sha256 || p.digest || p.content_digest || p.sha256 || '',
    environment: p.environment || p.target_environment || change?.environment || '',
    approver: p.approver_name || p.approver || change?.reviewer_name || '',
    issuedAt: p.issued_at || p.created_at || '',
    expiresAt,
    consumedAt: p.consumed_at || '',
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
