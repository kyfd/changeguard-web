export const STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿',
  CHECKING: '检查中',
  CHECK_FAILED: '检查失败',
  READY_FOR_EXPERIMENT: '待验证',
  EXPERIMENT_QUEUED: '实验排队',
  EXPERIMENT_RUNNING: '实验中',
  WAITING_APPROVAL: '待审批',
  APPROVED: '已批准',
  COMPLETED: '通行证已消费',
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
  { key: 'approve', label: '审批', match: ['WAITING_APPROVAL', 'REJECTED'] },
  { key: 'consume', label: 'CI 消费', match: ['APPROVED', 'COMPLETED'] },
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

/** 分母仅包含调用方当前已加载的变更，不代表全库。 */
export function consumptionStats(changes: readonly { status: string }[]) {
  const consumed = changes.filter(c => c.status === 'COMPLETED').length
  return { consumed, total: changes.length, percent: changes.length ? Math.round(consumed / changes.length * 100) : 0 }
}

export function passportStepLabel(key: string, status: string, label: string) {
  if (key !== 'consume') return label
  return status === 'COMPLETED' ? '已消费' : '待 CI 消费'
}

/** 以检查运行结论为准，发现项的整改状态不能代替检查结果。 */
export function checkSummary(change: any): string {
  const check = change?.check_run || change?.checkRun
  if (!check) return '暂无规则检查记录'
  const blocking = Number(check.blocking)
  if (Number.isFinite(blocking) && blocking > 0) return `最近检查有 ${blocking} 项阻断，请核对检查结果`
  if (check.status === 'PASSED' && blocking === 0) return '最近规则检查通过，无阻断项'
  if (check.status === 'FAILED') return '最近规则检查未通过，请核对检查结果'
  return `最近检查状态：${check.status || '未知'}`
}
