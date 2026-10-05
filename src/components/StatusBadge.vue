<script setup lang="ts">
import { STATUS_LABEL } from '@/lib/labels.ts'

const props = withDefaults(
  defineProps<{
    type?: 'risk' | 'status' | 'plain'
    value?: string
    size?: 'sm' | 'md'
  }>(),
  { type: 'plain', value: '', size: 'md' }
)

function tone(v: string): { c: string; label: string } {
  const s = String(v || '').toUpperCase()
  if (props.type === 'risk') {
    if (s === 'HIGH') return { c: 'high', label: '高危' }
    if (s === 'MEDIUM') return { c: 'medium', label: '中危' }
    if (s === 'LOW') return { c: 'low', label: '低危' }
    return { c: 'unknown', label: '待定' }
  }
  if (s === 'OK' || s === 'COMPLETED' || s === 'APPROVED' || s === 'ACTIVE' || s === 'PASSED' || s === 'REAL') {
    const zh: Record<string, string> = {
      OK: '正常',
      COMPLETED: STATUS_LABEL.COMPLETED,
      APPROVED: '已批准',
      ACTIVE: '运行中',
      PASSED: '通过',
      REAL: '真实',
    }
    return { c: 'ok', label: zh[s] || '正常' }
  }
  if (s === 'FAILED' || s === 'REJECTED' || s === 'ERROR' || s === 'CRITICAL') {
    return { c: 'err', label: STATUS_LABEL[s] || v || '异常' }
  }
  if (s === 'WAITING_APPROVAL' || s === 'PENDING' || s === 'QUEUED' || s === 'CHECKING') {
    return { c: 'warn', label: STATUS_LABEL[s] || v || '处理中' }
  }
  return { c: 'info', label: STATUS_LABEL[s] || v || '未知' }
}
</script>

<template>
  <span class="badge" :class="[`badge-${tone(value).c}`, `badge-${size}`]">
    <i class="badge-dot" aria-hidden="true"></i>
    <span class="badge-text"><slot>{{ tone(value).label }}</slot></span>
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  border-radius: var(--r-pill);
  border: 1px solid transparent;
  white-space: nowrap;
  line-height: 1;
  font-weight: var(--fw-medium);
  letter-spacing: -0.01em;
  transition: all var(--dur-fast);
}

.badge-sm {
  height: 22px;
  font-size: var(--fs-11);
  padding: 0 7px;
}

.badge-md {
  height: 26px;
  font-size: var(--fs-12);
  padding: 0 10px;
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex: none;
  box-shadow: 0 0 6px currentColor;
}

.badge-text {
  font-variant-numeric: tabular-nums;
}

/* 正常状态（绿色系） */
.badge-ok {
  color: var(--jade);
  background: var(--jade-soft);
  border-color: rgba(16, 185, 129, 0.25);
}

/* 警告/处理中状态（琥珀色系） */
.badge-warn, .badge-medium {
  color: var(--amber);
  background: var(--amber-soft);
  border-color: rgba(245, 158, 11, 0.28);
}

/* 危险/失败状态（朱砂红色系） */
.badge-err, .badge-high {
  color: var(--cinnabar);
  background: var(--cinnabar-soft);
  border-color: rgba(239, 68, 68, 0.28);
}

/* 低风险/品牌色 */
.badge-low {
  color: var(--brand);
  background: var(--brand-soft);
  border-color: rgba(79, 70, 229, 0.25);
}

/* 未知与默认状态 */
.badge-unknown, .badge-info {
  color: var(--text-mute);
  background: var(--surface-2);
  border-color: var(--line);
}
.badge-unknown .badge-dot, .badge-info .badge-dot {
  box-shadow: none;
  background: var(--text-faint);
}
</style>
