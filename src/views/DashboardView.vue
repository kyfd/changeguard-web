<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkspaceStore } from '@/stores/workspace'
import TechIcon from '@/components/TechIcon.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import NeonButton from '@/components/NeonButton.vue'
import { STATUS_LABEL, ownerOf, fmtTime } from '@/lib/labels'

const ws = useWorkspaceStore()
const router = useRouter()

const pending = computed(() => ws.changes.filter(c => c.status === 'WAITING_APPROVAL'))
const failed = computed(() => ws.changes.filter(c => c.status === 'CHECK_FAILED'))
const high = computed(() => ws.changes.filter(c => c.risk === 'HIGH' && !['APPROVED', 'COMPLETED', 'REJECTED'].includes(c.status)))
const recent = computed(() => [...ws.changes].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || '')).slice(0, 8))
const closed = computed(() => ws.changes.filter(c => ['APPROVED', 'COMPLETED'].includes(c.status)).length)
const closure = computed(() => ws.changes.length ? Math.round(closed.value / ws.changes.length * 100) : 0)

/* 待办按紧急度合并：待审批优先，其次检查失败，再次高危未闭环。
   KPI 与列表必须同源，否则会出现「待审批 0」却列出若干条的矛盾。 */
const inbox = computed(() => {
  const seen = new Set<string>()
  const out: { c: any; kind: string; tone: 'wait' | 'fail' | 'risk' }[] = []
  for (const c of pending.value) {
    if (seen.has(c.id)) continue
    seen.add(c.id); out.push({ c, kind: '待审批', tone: 'wait' })
  }
  for (const c of failed.value) {
    if (seen.has(c.id)) continue
    seen.add(c.id); out.push({ c, kind: '检查失败', tone: 'fail' })
  }
  for (const c of high.value) {
    if (seen.has(c.id)) continue
    seen.add(c.id); out.push({ c, kind: '高危未闭环', tone: 'risk' })
  }
  return out
})

const headline = computed(() => {
  const bits: string[] = []
  if (pending.value.length) bits.push(`${pending.value.length} 单待审批`)
  if (failed.value.length) bits.push(`${failed.value.length} 单检查未通过`)
  if (high.value.length) bits.push(`${high.value.length} 条高危未闭环`)
  if (!ws.changes.length) return '工作空间已就绪，等待第一张变更单'
  return bits.length ? bits.join(' · ') : '当前没有阻塞项，治理节奏平稳'
})

function open(id: string) { router.push({ name: 'change-detail', params: { id } }) }
function openDeck() {
  router.push({ name: 'panorama' })
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <div class="page-kicker mono">NOW</div>
        <div class="page-title">工作台</div>
        <div class="page-sub">{{ headline }}</div>
      </div>
      <div class="page-actions">
        <NeonButton variant="ghost" size="sm" @click="openDeck"><TechIcon name="activity" :size="15" /> 全景</NeonButton>
        <NeonButton size="sm" @click="ws.load(true)"><TechIcon name="refresh" :size="15" /> 刷新</NeonButton>
      </div>
    </div>

    <div class="now-grid">
      <button class="now-card" :class="{ mute: !pending.length }" @click="router.push({ name: 'approvals' })">
        <span>待审批</span>
        <strong>{{ pending.length }}</strong>
        <small>需要独立判断的变更</small>
      </button>
      <button class="now-card warn" :class="{ mute: !failed.length }" @click="router.push({ name: 'changes' })">
        <span>检查未通过</span>
        <strong>{{ failed.length }}</strong>
        <small>门禁拦下，需整改后重提</small>
      </button>
      <button class="now-card warn" :class="{ mute: !high.length }" @click="router.push({ name: 'risks' })">
        <span>高危未闭环</span>
        <strong>{{ high.length }}</strong>
        <small>整改完成前不可批准</small>
      </button>
      <button class="now-card" @click="router.push({ name: 'changes' })">
        <span>闭环率</span>
        <strong>{{ closure }}<em>%</em></strong>
        <small>已闭环 {{ closed }} / {{ ws.changes.length }}</small>
      </button>
    </div>

    <div class="split">
      <section class="queue">
        <header>
          <h3>待你处理<span class="count mono">{{ inbox.length }}</span></h3>
          <button class="text-link" @click="router.push({ name: 'approvals' })">全部审批</button>
        </header>
        <button v-for="it in inbox" :key="it.c.id" class="queue-row" @click="open(it.c.id)">
          <span class="tag" :class="it.tone">{{ it.kind }}</span>
          <div class="row-main">
            <strong class="ellipsis">{{ it.c.title || it.c.summary || '未命名变更' }}</strong>
            <small>{{ it.c.application_name || '未归属服务' }} · {{ ownerOf(it.c) }} · {{ fmtTime(it.c.updated_at) }}</small>
          </div>
          <StatusBadge type="risk" :value="it.c.risk" size="sm" />
        </button>
        <div v-if="!inbox.length" class="empty-full">没有需要立即处理的事项</div>
      </section>

      <section class="queue">
        <header>
          <h3>最近轨迹</h3>
          <button class="text-link" @click="router.push({ name: 'changes' })">全部变更</button>
        </header>
        <button v-for="c in recent" :key="c.id" class="queue-row compact" @click="open(c.id)">
          <StatusBadge type="status" :value="c.status" size="sm">{{ STATUS_LABEL[c.status] || c.status }}</StatusBadge>
          <div class="row-main">
            <strong class="ellipsis">{{ c.title || c.summary || '未命名变更' }}</strong>
            <small class="mono">{{ String(c.id).slice(0, 8) }} · {{ fmtTime(c.updated_at) }}</small>
          </div>
        </button>
        <div v-if="!recent.length" class="empty-full">还没有变更记录</div>
      </section>
    </div>
  </div>
</template>

<style scoped>
@import './page.css';
.now-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--sp-3); margin-bottom: var(--sp-3); flex: none; }
.now-card {
  text-align: left; padding: var(--sp-3) var(--sp-4); border-radius: var(--r);
  background: var(--surface); border: 1px solid var(--line); color: inherit;
  transition: border-color var(--dur-fast), background var(--dur-fast);
}
.now-card span { font-size: var(--fs-12); color: var(--text-mute); }
.now-card strong {
  display: block; margin: var(--sp-1) 0 2px;
  font-size: var(--fs-24); color: var(--brand-bright);
  font-weight: var(--fw-semibold); font-family: var(--font-mono); line-height: var(--lh-tight);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}
.now-card strong em { font-style: normal; font-size: var(--fs-13); margin-left: 2px; color: var(--text-mute); }
.now-card small { color: var(--text-faint); font-size: var(--fs-11); line-height: var(--lh-snug); }
.now-card.warn strong { color: var(--cinnabar); }
/* 零值不该抢占视觉重心：没有待办时降为静默态 */
.now-card.mute strong { color: var(--text-faint); }
.now-card:hover { border-color: var(--line-bright); background: var(--bg-elev); }

/* 左栏是行动队列（长），右栏是参考轨迹（短），等宽会一边空一边裁 */
.split { display: grid; grid-template-columns: 3fr 2fr; gap: var(--sp-3); min-height: 0; }
.queue {
  display: flex; flex-direction: column;
  background: var(--surface); border: 1px solid var(--line); border-radius: var(--r);
  min-height: 0; overflow: auto;
}
.queue header {
  display: flex; align-items: center; justify-content: space-between;
  height: 40px; padding: 0 var(--sp-4); flex: none;
  border-bottom: 1px solid var(--line);
  position: sticky; top: 0; background: var(--surface-2); z-index: 1;
}
.queue h3 { font-size: var(--fs-13); color: var(--text-strong); font-weight: var(--fw-medium); display: flex; align-items: center; gap: var(--sp-2); }
.queue h3 .count {
  font-size: var(--fs-11); color: var(--text-mute); background: var(--bg-elev);
  border: 1px solid var(--line); border-radius: 3px; padding: 1px 5px;
  font-variant-numeric: tabular-nums; font-family: var(--font-mono);
}
.text-link { font-size: var(--fs-12); color: var(--gold-bright); }
.queue-row {
  width: 100%; display: flex; align-items: center; gap: var(--sp-3);
  min-height: 48px; padding: var(--sp-2) var(--sp-4);
  border-bottom: 1px solid var(--line); text-align: left; color: inherit;
  flex: none; transition: background var(--dur-fast);
}
.queue-row:hover { background: var(--gold-soft); }
.queue-row.compact { min-height: 40px; }
.queue-row .row-main { min-width: 0; flex: 1; }
.queue-row strong { display: block; font-size: var(--fs-13); color: var(--text-strong); font-weight: var(--fw-regular); }
.queue-row small { display: block; margin-top: 2px; font-size: var(--fs-11); color: var(--text-mute); }
.queue-row:hover strong { color: var(--gold-bright); }
.ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* 事项类别用方形标签，与状态徽章区分开 */
.tag {
  flex: none; font-size: var(--fs-11); letter-spacing: 0.02em; padding: 2px 6px;
  border-radius: 3px; border: 1px solid var(--line); color: var(--text-mute);
  font-family: var(--font-mono); white-space: nowrap;
}
.tag.wait { color: var(--gold-bright); border-color: color-mix(in srgb, var(--gold) 45%, transparent); }
.tag.fail { color: var(--cinnabar); border-color: color-mix(in srgb, var(--cinnabar) 45%, transparent); }
.tag.risk { color: var(--cinnabar); border-color: color-mix(in srgb, var(--cinnabar) 30%, transparent); }

@media (max-width: 1180px) {
  .now-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 980px) {
  .now-grid, .split { grid-template-columns: 1fr; }
}
</style>
