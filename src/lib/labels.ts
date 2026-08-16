export const STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿',
  CHECKING: '检查中',
  CHECK_FAILED: '检查失败',
  READY_FOR_EXPERIMENT: '待验证',
  EXPERIMENT_QUEUED: '实验排队',
  EXPERIMENT_RUNNING: '实验中',
  WAITING_APPROVAL: '待审批',
  APPROVED: '已批准',
  COMPLETED: '已完成',
  REJECTED: '已拒绝',
}

export const RISK_LABEL: Record<string, string> = {
  HIGH: '高危', MEDIUM: '中危', LOW: '低危', UNKNOWN: '待定',
}

export const EVIDENCE_LABEL: Record<string, string> = {
  REAL: '真实证据', NOT_RUN: '未验证', FAILED: '验证失败', DEMO_ONLY: '演示',
}

export const PASSPORT_STEPS = [
  { key: 'submit', label: '提交', match: ['DRAFT'] },
  { key: 'check', label: '规则检查', match: ['CHECKING', 'CHECK_FAILED', 'READY_FOR_EXPERIMENT'] },
  { key: 'verify', label: '预发验证', match: ['EXPERIMENT_QUEUED', 'EXPERIMENT_RUNNING'] },
  { key: 'approve', label: '审批', match: ['WAITING_APPROVAL'] },
  { key: 'close', label: '闭环', match: ['APPROVED', 'COMPLETED', 'REJECTED'] },
] as const

export function stepIndex(status?: string) {
  const s = String(status || 'DRAFT').toUpperCase()
  const i = PASSPORT_STEPS.findIndex(st => (st.match as readonly string[]).includes(s))
  return i < 0 ? 0 : i
}

export function ownerOf(c: any) {
  return c?.owner_name || c?.owner || c?.reviewer_name || '—'
}

export function fmtTime(t?: string, withSeconds = false) {
  if (!t) return '—'
  const value = new Date(t)
  if (!Number.isFinite(value.getTime())) return '—'
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'short',
    timeStyle: withSeconds ? 'medium' : 'short',
    hour12: false,
  }).format(value)
}
