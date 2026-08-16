<script setup lang="ts">
/* 状态/风险指示器：点 + 文字，无辉光 */
const props = withDefaults(defineProps<{
  type?: 'risk' | 'status' | 'plain'
  value?: string
  size?: 'sm' | 'md'
}>(), { type: 'plain', value: '', size: 'md' })

function tone(v: string): { c: string; label: string } {
  const s = String(v || '').toUpperCase()
  if (props.type === 'risk') {
    if (s === 'HIGH') return { c: 'high', label: '高危' }
    if (s === 'MEDIUM') return { c: 'medium', label: '中危' }
    if (s === 'LOW') return { c: 'low', label: '低危' }
    return { c: 'unknown', label: '待定' }
  }
  if (s === 'OK' || s === 'COMPLETED' || s === 'APPROVED' || s === 'ACTIVE' || s === 'PASSED' || s === 'REAL') {
    const zh: Record<string, string> = { OK: '正常', COMPLETED: '已完成', APPROVED: '已批准', ACTIVE: '运行中', PASSED: '通过', REAL: '真实' }
    return { c: 'ok', label: zh[s] || '正常' }
  }
  if (s === 'FAILED' || s === 'REJECTED' || s === 'ERROR' || s === 'CRITICAL') return { c: 'err', label: v || '异常' }
  if (s === 'WAITING_APPROVAL' || s === 'PENDING' || s === 'QUEUED' || s === 'CHECKING') return { c: 'warn', label: v || '处理中' }
  return { c: 'info', label: v || '未知' }
}
</script>

<template>
  <span class="badge" :class="[`badge-${tone(value).c}`, `badge-${size}`]">
    <i class="badge-dot" aria-hidden="true"></i>
    <slot>{{ tone(value).label }}</slot>
  </span>
</template>

<style scoped>
.badge { display: inline-flex; align-items: center; gap: .45em; border-radius: var(--r-sm); white-space: nowrap; line-height: 1; letter-spacing: 0; font-weight: 500; }
.badge-sm { font-size: .78rem; padding: .28em .65em; }
.badge-md { font-size: .84rem; padding: .34em .75em; }
.badge-dot { width: 6px; height: 6px; border-radius: 50%; flex: none; }

.badge-ok { color: var(--jade-bright); background: var(--jade-soft); border: 1px solid rgba(111,155,122,.28); }
.badge-ok .badge-dot { background: var(--jade); }
.badge-warn { color: var(--amber); background: var(--amber-soft); border: 1px solid rgba(201,161,91,.3); }
.badge-warn .badge-dot { background: var(--amber); }
.badge-err { color: var(--red-bright); background: var(--red-soft); border: 1px solid rgba(196,92,74,.3); }
.badge-err .badge-dot { background: var(--cinnabar); }
.badge-high { color: var(--red-bright); background: var(--red-soft); border: 1px solid rgba(196,92,74,.32); }
.badge-high .badge-dot { background: var(--cinnabar); }
.badge-medium { color: var(--amber); background: var(--amber-soft); border: 1px solid rgba(201,161,91,.32); }
.badge-medium .badge-dot { background: var(--amber); }
.badge-low { color: var(--jade-bright); background: var(--jade-soft); border: 1px solid rgba(111,155,122,.28); }
.badge-low .badge-dot { background: var(--jade); }
.badge-unknown, .badge-info { color: var(--text-mute); background: rgba(110,105,96,.12); border: 1px solid var(--line); }
.badge-unknown .badge-dot, .badge-info .badge-dot { background: var(--text-faint); }
</style>
