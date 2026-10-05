<script setup lang="ts">
defineProps<{
  findings?: any[]
  checkRun?: any
  summary: string
}>()

const riskLabel: Record<string, string> = {
  HIGH: '高危',
  MEDIUM: '中危',
  LOW: '低危',
  UNKNOWN: '待定',
}

const findingState: Record<string, [string, string]> = {
  OPEN: ['待处理', 'open'],
  ASSIGNED: ['整改中', 'assigned'],
  RESOLVED: ['待复核', 'resolved'],
  VERIFIED: ['已闭环', 'verified'],
}
</script>

<template>
  <div class="dpanel">
    <div class="dpanel-head">
      <h3>确定性规则检查</h3>
      <span class="count-tag">{{ findings?.length || 0 }} 项证据</span>
    </div>

    <div v-if="!findings?.length" class="empty-full">
      {{ checkRun ? summary + '；本次未返回发现项。' : '暂无规则检查记录。' }}
    </div>

    <div v-else class="finding-list">
      <div v-for="f in findings" :key="f.id" class="finding-card">
        <span class="finding-level" :class="String(f.severity || '').toLowerCase()">
          {{ riskLabel[f.severity] || '—' }}
        </span>
        <div class="finding-main">
          <div class="finding-title-row">
            <h4>{{ f.title }}</h4>
            <span
              class="finding-state"
              :class="'finding-state-' + (findingState[f.status]?.[1] || 'open')"
            >
              {{ findingState[f.status]?.[0] || f.status }}
            </span>
          </div>
          <p class="finding-detail">{{ f.detail }}</p>
          <div v-if="f.evidence" class="finding-evidence mono">{{ f.evidence }}</div>
          <div v-if="f.suggestion" class="finding-suggestion">建议：{{ f.suggestion }}</div>
          <div class="finding-ownership">
            <span><b>负责人</b>{{ f.owner_name || '待分配' }}</span>
            <span><b>规则编号</b>{{ f.code }}</span>
            <span v-if="f.blocking" class="blocking-tag">阻断项</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dpanel {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-xl);
  padding: var(--sp-5);
  margin-bottom: var(--sp-5);
}

.dpanel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--sp-4);
}

.dpanel-head h3 {
  margin: 0;
  font-size: var(--fs-16);
  font-weight: var(--fw-semibold);
  color: var(--text-strong);
}

.count-tag {
  font-size: var(--fs-12);
  color: var(--text-mute);
  font-family: var(--font-mono);
}

.empty-full {
  text-align: center;
  padding: var(--sp-8) var(--sp-4);
  color: var(--text-mute);
  font-size: var(--fs-13);
}

.finding-list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.finding-card {
  display: flex;
  gap: var(--sp-3);
  padding: var(--sp-4);
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: var(--r);
  position: relative;
}

.finding-level {
  align-self: flex-start;
  padding: 2px 6px;
  border-radius: var(--r-sm);
  font-size: var(--fs-11);
  font-weight: var(--fw-semibold);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.finding-level.high {
  background: var(--cinnabar-soft);
  color: var(--cinnabar);
}

.finding-level.medium {
  background: var(--amber-soft);
  color: var(--amber);
}

.finding-level.low {
  background: var(--brand-soft);
  color: var(--brand);
}

.finding-main {
  flex: 1;
  min-width: 0;
}

.finding-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
  margin-bottom: var(--sp-1);
}

.finding-title-row h4 {
  margin: 0;
  font-size: var(--fs-14);
  font-weight: var(--fw-medium);
  color: var(--text-strong);
}

.finding-state {
  font-size: var(--fs-11);
  padding: 1px 6px;
  border-radius: var(--r-pill);
}

.finding-state-open {
  background: var(--cinnabar-soft);
  color: var(--cinnabar);
}

.finding-state-assigned {
  background: var(--amber-soft);
  color: var(--amber);
}

.finding-state-resolved {
  background: var(--brand-soft);
  color: var(--brand);
}

.finding-state-verified {
  background: var(--jade-soft);
  color: var(--jade);
}

.finding-detail {
  margin: var(--sp-1) 0;
  font-size: var(--fs-13);
  color: var(--text);
  line-height: var(--lh-base);
}

.finding-evidence {
  margin: var(--sp-2) 0;
  padding: var(--sp-2) var(--sp-3);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  font-size: var(--fs-12);
  color: var(--text-strong);
  overflow-x: auto;
}

.finding-suggestion {
  font-size: var(--fs-12);
  color: var(--brand);
  background: var(--brand-soft);
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--r-sm);
  margin: var(--sp-2) 0;
}

.finding-ownership {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  margin-top: var(--sp-2);
  font-size: var(--fs-11);
  color: var(--text-faint);
}

.finding-ownership b {
  color: var(--text-mute);
  margin-right: var(--sp-1);
  font-weight: var(--fw-normal);
}

.blocking-tag {
  background: var(--cinnabar);
  color: #fff;
  padding: 1px 5px;
  border-radius: var(--r-xs);
  font-weight: var(--fw-medium);
}
</style>
