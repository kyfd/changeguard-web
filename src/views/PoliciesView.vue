<script setup lang="ts">
import { ref } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { api } from '@/api/client'
import TechIcon from '@/components/TechIcon.vue'
import NeonButton from '@/components/NeonButton.vue'

const ws = useWorkspaceStore()
const busy = ref<Record<string, boolean>>({})

const sevLabel: Record<string, string> = { HIGH: '高危', MEDIUM: '中危', LOW: '低危' }

async function toggle(id: string) {
  busy.value[id] = true
  try { await api.togglePolicy(id); await ws.load(true) }
  catch (e: any) { alert(e?.message || '操作失败') }
  finally { busy.value[id] = false }
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <div class="page-title">检查规则</div>
        <div class="page-sub">策略库 · {{ ws.policies.length }} 条 · {{ ws.policies.filter((p: any) => p.enabled !== false).length }} 启用</div>
      </div>
      <div class="page-actions"><NeonButton size="sm" @click="ws.load(true)"><TechIcon name="refresh" :size="15" /> 刷新</NeonButton></div>
    </div>

    <div v-if="!ws.policies.length" class="empty-full">暂无检查规则</div>
    <div v-else class="ledger">
      <div class="ledger-head" aria-hidden="true">
        <span>规则</span>
        <span>说明</span>
        <span>等级</span>
        <span>状态</span>
      </div>
      <article v-for="p in ws.policies" :key="p.id" class="row" :class="{ off: p.enabled === false }">
        <div class="name">
          <h3>{{ p.title || p.name || '未命名规则' }}</h3>
          <small class="id-cell">{{ String(p.id).slice(0, 10) }}</small>
        </div>
        <p>{{ p.description || p.pattern || '暂无说明' }}</p>
        <span class="sev" :class="'sv-' + String(p.severity || '').toLowerCase()">{{ sevLabel[String(p.severity || '').toUpperCase()] || p.severity || '—' }}</span>
        <!-- 状态和操作合成一个开关，避免同一行出现两个相反的词 -->
        <button
          type="button"
          class="sw"
          :class="{ on: p.enabled !== false, busy: busy[p.id] }"
          :disabled="busy[p.id]"
          role="switch"
          :aria-checked="p.enabled !== false"
          :title="p.enabled !== false ? '点击停用' : '点击启用'"
          @click="toggle(p.id)"
        >
          <i class="sw-track"><em></em></i>
          <span class="sw-text">{{ p.enabled !== false ? '启用' : '停用' }}</span>
        </button>
      </article>
    </div>
  </div>
</template>

<style scoped>
@import './page.css';

.ledger {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  background: var(--surface);
  box-shadow: var(--shadow-card);
}
:root[data-theme="light"] .ledger { box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6), var(--shadow-card); }
.ledger-head,
.row {
  display: grid;
  grid-template-columns: minmax(144px, 0.9fr) minmax(0, 1.5fr) 68px 88px;
  gap: var(--sp-4);
  align-items: center;
  padding: var(--sp-3) var(--sp-4);
}
.ledger-head {
  font-family: var(--font-mono);
  font-size: var(--fs-11);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-faint);
  border-bottom: 1px solid var(--line);
  position: sticky;
  top: 0;
  background: var(--surface);
  z-index: 1;
  padding-top: var(--sp-2);
  padding-bottom: var(--sp-2);
}
.row { border-top: 1px solid var(--line); min-width: 0; }
.row:first-of-type { border-top: none; }
.row:hover { background: var(--bg-elev); }
.row.off { opacity: 0.55; }
.name { min-width: 0; }
.name h3 {
  margin: 0;
  font-size: var(--fs-13);
  font-weight: var(--fw-medium);
  color: var(--text-strong);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.name small { display: block; margin-top: 1px; font-size: var(--fs-11); }
.row p {
  margin: 0;
  font-size: var(--fs-12);
  color: var(--text-mute);
  line-height: var(--lh-snug);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-width: 0;
}
.sev {
  font-size: var(--fs-12);
  white-space: nowrap;
}
.sv-high { color: var(--cinnabar); }
.sv-medium { color: var(--amber); }
.sv-low { color: var(--jade); }

/* 开关本身即状态显示，无需额外徽章 */
.sw {
  display: inline-flex; align-items: center; gap: var(--sp-2);
  color: var(--text-mute); font-size: var(--fs-12);
}
.sw-track {
  position: relative; width: 26px; height: 15px; flex: none;
  border-radius: var(--r-pill); background: var(--line-strong);
  transition: background var(--dur-fast);
}
.sw-track em {
  position: absolute; top: 2px; left: 2px;
  width: 11px; height: 11px; border-radius: 50%;
  background: var(--surface); box-shadow: 0 1px 2px rgba(0,0,0,0.25);
  transition: transform var(--dur-fast) var(--ease);
}
.sw.on .sw-track { background: var(--jade); }
.sw.on .sw-track em { transform: translateX(11px); }
.sw.on .sw-text { color: var(--text); }
.sw.busy { opacity: 0.5; cursor: progress; }
.sw:not(.busy):hover .sw-track { background: var(--text-faint); }
.sw.on:not(.busy):hover .sw-track { background: color-mix(in srgb, var(--jade) 80%, #000); }

@media (max-width: 900px) {
  .ledger-head { display: none; }
  .row {
    grid-template-columns: 1fr auto;
    gap: var(--sp-1) var(--sp-3);
  }
  .row p { grid-column: 1 / -1; }
}
</style>
