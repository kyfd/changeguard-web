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
.badge {
  display: inline-flex; align-items: center; gap: 6px; padding: 2px 8px;
  border-radius: var(--r-sm); border: 1px solid var(--line);
  white-space: nowrap; line-height: 1.3; letter-spacing: 0; font-weight: var(--fw-medium);
}
/* 固定高度：徽章在表格单元格里必须与同行文本基线稳定对齐 */
.badge-sm { height: 20px; font-size: var(--fs-11); }
.badge-md { height: 24px; font-size: var(--fs-12); }
.badge-dot { width: 6px; height: 6px; border-radius: var(--r-xs); flex: none; }

.badge-ok { color: var(--jade); background: var(--jade-soft); }
.badge-ok .badge-dot { background: var(--jade); }
.badge-warn { color: var(--amber); background: var(--amber-soft); }
.badge-warn .badge-dot { background: var(--amber); }
.badge-err { color: var(--cinnabar); background: var(--cinnabar-soft); }
.badge-err .badge-dot { background: var(--cinnabar); }
.badge-high { color: var(--cinnabar); background: var(--cinnabar-soft); }
.badge-high .badge-dot { background: var(--cinnabar); }
.badge-medium { color: var(--amber); background: var(--amber-soft); }
.badge-medium .badge-dot { background: var(--amber); }
.badge-low { color: var(--brand-bright); background: var(--brand-soft); }
.badge-low .badge-dot { background: var(--brand); }
.badge-unknown, .badge-info { color: var(--text-mute); background: var(--surface-2); }
.badge-unknown .badge-dot, .badge-info .badge-dot { background: var(--text-faint); }
</style>
