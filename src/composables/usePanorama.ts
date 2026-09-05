import { computed } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { consumptionStats } from '@/lib/labels'
import type { Change } from '@/api/types'

/* 总览页指标，全部从工作区数据派生 */
export function usePanorama() {
  const ws = useWorkspaceStore()

  const changes = computed<Change[]>(() => ws.changes)
  const total = computed(() => changes.value.length)

  const risks = computed(() => {
    const r = { HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 } as Record<string, number>
    changes.value.forEach(c => { r[c.risk] = (r[c.risk] || 0) + 1 })
    return r
  })

  const highRisk = computed(() => risks.value.HIGH || 0)
  const riskTotal = computed(() => Object.values(risks.value).reduce((a, b) => a + b, 0))

  const appRanking = computed(() => {
    const counts = new Map<string, number>()
    changes.value.forEach(c => {
      const key = c.application_id || c.application_name || '未归属'
      counts.set(key, (counts.get(key) || 0) + 1)
    })
    const apps = Array.isArray(ws.apps) ? ws.apps.filter(Boolean) : []
    return apps.map((a: any) => ({
      name: a?.name || a?.code || '未命名',
      count: counts.get(a?.id) || counts.get(a?.name) || 0,
    })).sort((a, b) => b.count - a.count).slice(0, 6)
  })

  const topRules = computed(() => {
    const map = new Map<string, { code: string; title: string; count: number; severity: string }>()
    changes.value.flatMap(c => c.findings || []).forEach(f => {
      const code = f.code || 'UNCLASSIFIED'
      const cur = map.get(code) || { code, title: f.title || code, count: 0, severity: f.severity || 'UNKNOWN' }
      cur.count += 1
      map.set(code, cur)
    })
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 6)
  })

  const flow = computed(() => [
    { label: '草稿', statuses: ['DRAFT'], route: 'changes' },
    { label: '检查整改', statuses: ['CHECKING', 'CHECK_FAILED', 'READY_FOR_EXPERIMENT'], route: 'changes' },
    { label: '预发布验证', statuses: ['EXPERIMENT_QUEUED', 'EXPERIMENT_RUNNING'], route: 'risks' },
    { label: '等待审批', statuses: ['WAITING_APPROVAL'], route: 'approvals' },
    { label: '已批准', statuses: ['APPROVED'], route: 'changes' },
    { label: '通行证已消费', statuses: ['COMPLETED'], route: 'changes' },
    { label: '已拒绝', statuses: ['REJECTED'], route: 'changes' },
  ].map(s => ({ ...s, count: changes.value.filter(c => s.statuses.includes(c.status)).length })))

  const pending = computed(() => changes.value.filter(c => c.status === 'WAITING_APPROVAL').length)
  const consumption = computed(() => consumptionStats(changes.value))
  const closed = computed(() => consumption.value.consumed)
  const experiments = computed(() => changes.value.filter(c => c.experiment).length)
  const enabledPolicies = computed(() => (ws.policies || []).filter(p => p.enabled !== false).length)

  const threat = computed(() => {
    const ratio = total.value ? highRisk.value / total.value : 0
    if (ratio >= 0.35 || highRisk.value >= 5) return { level: 'CRITICAL', label: '危急', tone: 'red' }
    if (ratio >= 0.15 || highRisk.value >= 2) return { level: 'ELEVATED', label: '升高', tone: 'amber' }
    if (pending.value >= 3) return { level: 'WATCH', label: '关注', tone: 'cyan' }
    return { level: 'NOMINAL', label: '平稳', tone: 'green' }
  })

  const closureRate = computed(() => consumption.value.percent)

  // 拓扑卫星节点（中央核心周围的业务节点）
  const nodes = computed(() => [
    { key: 'changes', label: '变更单', value: total.value, route: 'changes', icon: 'code', angle: 0 },
    { key: 'approvals', label: '待审批', value: pending.value, route: 'approvals', icon: 'check-circle', angle: 72 },
    { key: 'risks', label: '高危', value: highRisk.value, route: 'risks', icon: 'shield-alert', angle: 144 },
    { key: 'policies', label: '规则', value: ws.policies?.length || 0, route: 'policies', icon: 'shield', angle: 216 },
    { key: 'apps', label: '服务', value: ws.apps?.length || 0, route: 'apps', icon: 'server', angle: 288 },
  ])

  return {
    ws, changes, total, risks, highRisk, riskTotal, appRanking, topRules, flow,
    pending, closed, experiments, enabledPolicies, threat, closureRate, nodes,
  }
}
