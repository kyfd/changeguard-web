import type { App, Change } from '../api/types'

export const PANORAMA_STAGES = [
  {
    id: 'draft',
    label: '草稿',
    caption: '准备变更内容',
    code: '01 / INPUT',
    statuses: ['DRAFT'],
  },
  {
    id: 'check',
    label: '规则检查',
    caption: '检查中 · 失败整改 · 待验证',
    code: '02 / CHECK',
    statuses: ['CHECKING', 'CHECK_FAILED', 'READY_FOR_EXPERIMENT'],
  },
  {
    id: 'verify',
    label: '预发验证',
    caption: '实验排队 · 实验执行中',
    code: '03 / VERIFY',
    statuses: ['EXPERIMENT_QUEUED', 'EXPERIMENT_RUNNING'],
  },
  {
    id: 'approve',
    label: '等待审批',
    caption: '等待独立复核',
    code: '04 / REVIEW',
    statuses: ['WAITING_APPROVAL'],
  },
  {
    id: 'ready',
    label: '已批准',
    caption: '尚未消费通行证',
    code: '05 / APPROVED',
    statuses: ['APPROVED'],
  },
  {
    id: 'consumed',
    label: '通行证已消费',
    caption: 'CI 消费已记录',
    code: '06 / CONSUMED',
    statuses: ['COMPLETED'],
  },
  {
    id: 'rejected',
    label: '已拒绝',
    caption: '审批未放行',
    code: 'BRANCH',
    statuses: ['REJECTED'],
  },
  {
    id: 'unknown',
    label: '其他状态',
    caption: '保留未识别的状态',
    code: 'UNMAPPED',
    statuses: [],
  },
] as const

export type StageId = (typeof PANORAMA_STAGES)[number]['id']
export function stageOf(status: string): StageId {
  return (
    PANORAMA_STAGES.find((stage) =>
      (stage.statuses as readonly string[]).includes(status),
    )?.id || 'unknown'
  )
}
export function changeTime(change: Change) {
  for (const value of [change.updated_at, change.created_at]) {
    const time = value ? Date.parse(value) : NaN
    if (Number.isFinite(time)) return time
  }
  return 0
}
export function buildPanorama(
  changes: readonly Change[],
  apps: readonly App[],
) {
  const stages = PANORAMA_STAGES.map((stage) => ({
    ...stage,
    count: changes.filter((change) => stageOf(change.status) === stage.id)
      .length,
  }))
  const riskRows = [
    { key: 'HIGH', label: '高危', tone: 'red', count: 0 },
    { key: 'MEDIUM', label: '中危', tone: 'amber', count: 0 },
    { key: 'LOW', label: '低危', tone: 'cyan', count: 0 },
    { key: 'UNKNOWN', label: '未评级', tone: 'muted', count: 0 },
  ]
  for (const change of changes)
    (riskRows.find((row) => row.key === change.risk) || riskRows[3]).count++
  const appById = new Map(apps.map((app) => [app.id, app]))
  const serviceMap = new Map<
    string,
    { id: string; name: string; count: number }
  >()
  for (const change of changes) {
    const id = change.application_id
    const key = id
      ? `id:${id}`
      : change.application_name
        ? `name:${change.application_name}`
        : 'unassigned'
    const app = id ? appById.get(id) : undefined
    const current = serviceMap.get(key) || {
      id: key,
      name:
        app?.name ||
        app?.code ||
        change.application_name ||
        (id ? `未登记服务 · ${id}` : '未归属服务'),
      count: 0,
    }
    current.count++
    serviceMap.set(key, current)
  }
  const rules = new Map<
    string,
    { code: string; title: string; count: number }
  >()
  for (const finding of changes.flatMap((change) => change.findings || [])) {
    const code = finding.code || 'UNCLASSIFIED'
    const rule = rules.get(code) || {
      code,
      title: finding.title || code,
      count: 0,
    }
    rule.count++
    rules.set(code, rule)
  }
  return {
    total: changes.length,
    consumed: changes.filter((change) => change.status === 'COMPLETED').length,
    pending: changes.filter((change) => change.status === 'WAITING_APPROVAL')
      .length,
    failed: changes.filter((change) => change.status === 'CHECK_FAILED').length,
    high: riskRows[0].count,
    stages,
    riskRows,
    services: [...serviceMap.values()].sort(
      (a, b) => b.count - a.count || a.id.localeCompare(b.id),
    ),
    rules: [...rules.values()].sort(
      (a, b) => b.count - a.count || a.code.localeCompare(b.code),
    ),
    recent: [...changes].sort(
      (a, b) => changeTime(b) - changeTime(a) || a.id.localeCompare(b.id),
    ),
  }
}
