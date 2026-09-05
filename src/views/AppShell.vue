<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed } from 'vue'
import { RouterView, useRouter, useRoute } from 'vue-router'
import { useAuthStore, useWorkspaceStore } from '@/stores/workspace'
import TechIcon from '@/components/TechIcon.vue'
import BrandLogo from '@/components/BrandLogo.vue'
import { STATUS_LABEL } from '@/lib/labels'
import { useTheme } from '@/composables/useTheme'


const auth = useAuthStore()
const ws = useWorkspaceStore()
const router = useRouter()
const route = useRoute()
const theme = useTheme()

const navGroups = [
  {
    label: '工作',
    items: [
      { to: 'dashboard', label: '工作台', icon: 'gauge' },
      { to: 'panorama', label: '总览', icon: 'activity' },
    ],
  },
  {
    label: '变更',
    items: [
      { to: 'changes', label: '变更工单', icon: 'code' },
      { to: 'approvals', label: '审批中心', icon: 'check-circle' },
      { to: 'risks', label: '风险中心', icon: 'shield-alert' },
    ],
  },
  {
    label: '设置',
    items: [
      { to: 'policies', label: '检查规则', icon: 'shield' },
      { to: 'apps', label: '服务', icon: 'server' },
      { to: 'audits', label: '审计日志', icon: 'scroll-text' },
      { to: 'settings', label: '系统设置', icon: 'settings' },
    ],
  },
]

const collapsed = ref(false)
const mobileOpen = ref(false)
const query = ref('')
const searchOpen = ref(false)
const isPanorama = computed(() => route.name === 'panorama')
const pendingCount = computed(() => ws.changes.filter(c => c.status === 'WAITING_APPROVAL').length)
const pageTitle = computed(() => (route.meta.title as string) || 'ChangeGuard')
const clock = ref('')
let clockTimer: any

function tick() {
  clock.value = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date())
}

const hits = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (q.length < 1) return [] as { kind: string; title: string; sub: string; to: any }[]
  const out: { kind: string; title: string; sub: string; to: any }[] = []
  for (const c of ws.changes) {
    const blob = `${c.title || ''} ${c.summary || ''} ${c.id || ''} ${c.application_name || ''} ${c.owner_name || ''}`.toLowerCase()
    if (blob.includes(q)) {
      out.push({
        kind: '变更',
        title: String(c.title || c.summary || c.id),
        sub: STATUS_LABEL[c.status] || c.status,
        to: { name: 'change-detail', params: { id: c.id } },
      })
    }
    if (out.length >= 6) break
  }
  for (const a of ws.apps) {
    const blob = `${a.name || ''} ${a.code || ''} ${a.id || ''}`.toLowerCase()
    if (blob.includes(q)) {
      out.push({ kind: '服务', title: String(a.name || a.code || a.id), sub: a.status || 'active', to: { name: 'apps' } })
    }
    if (out.length >= 8) break
  }
  return out
})

function closeSearchLater() {
  globalThis.setTimeout(() => { searchOpen.value = false }, 160)
}

function goHit(hit: { to: any }) {
  query.value = ''
  searchOpen.value = false
  mobileOpen.value = false
  router.push(hit.to)
}

function goNav(to: string) {
  mobileOpen.value = false
  if (route.name !== to) router.push({ name: to })
}

async function doLogout() {
  await auth.logout()
  ws.clear()
  router.push({ name: 'login' })
}

onMounted(() => {
  tick(); clockTimer = setInterval(tick, 1000)
  ws.load().catch(() => {})
})
onBeforeUnmount(() => {
  clearInterval(clockTimer)
})
</script>

<template>
  <div class="shell" :class="{ collapsed, 'mobile-open': mobileOpen, 'deck-full': isPanorama }">
    <div v-if="mobileOpen" class="scrim" @click="mobileOpen = false"></div>
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true"><BrandLogo :size="16" /></div>
        <div class="brand-text">
          <strong>ChangeGuard</strong>
          <span>变更检查与审批</span>
        </div>
      </div>

      <nav class="nav">
        <template v-for="g in navGroups" :key="g.label">
          <div class="nav-group">{{ g.label }}</div>
          <button
            v-for="item in g.items" :key="item.to"
            type="button"
            class="nav-item"
            :class="{ 'router-link-active': route.name === item.to }"
            @click="goNav(item.to)"
          >
            <span class="nav-ico"><TechIcon :name="item.icon" :size="15" /></span>
            <span class="nav-label">{{ item.label }}</span>
            <span v-if="item.to === 'approvals' && pendingCount" class="nav-badge">{{ pendingCount }}</span>
          </button>
        </template>
      </nav>

      <div class="side-foot">
        <div class="svc">
          <span class="dot" :class="ws.error ? 'dot-err' : ws.loading ? 'dot-warn' : ''" aria-hidden="true"></span>
          <div><strong>{{ ws.loading ? '正在读取' : ws.error ? '读取失败' : ws.loadedAt ? '最近更新' : '尚未读取' }}</strong><span>{{ ws.error ? '请重试刷新' : ws.loadedAt ? new Date(ws.loadedAt).toLocaleTimeString('zh-CN', { hour12: false }) : '工作区数据' }}</span></div>
        </div>
        <button class="collapse" @click="collapsed = !collapsed" :aria-label="collapsed ? '展开' : '收起'">
          <TechIcon name="chevron-right" :size="16" />
        </button>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <div class="topbar-left">
          <button class="ghost-btn mobile-menu" aria-label="菜单" @click="mobileOpen = !mobileOpen">
            <TechIcon name="menu" :size="20" />
          </button>
          <div class="crumb">
            <span class="crumb-root">ChangeGuard</span>
            <TechIcon name="chevron-right" :size="13" />
            <span class="crumb-now">{{ pageTitle }}</span>
          </div>
        </div>
        <div class="topbar-right">
          <div class="search-wrap">
            <label class="search">
              <TechIcon name="search" :size="15" />
              <input
                v-model="query"
                placeholder="搜索变更、服务、负责人"
                @focus="searchOpen = true"
                @blur="closeSearchLater"
              />
            </label>
            <div v-if="searchOpen && query.trim()" class="hits">
              <button v-for="h in hits" :key="h.kind + h.title" type="button" class="hit" @mousedown.prevent="goHit(h)">
                <span class="hit-kind">{{ h.kind }}</span>
                <span class="hit-title">{{ h.title }}</span>
                <span class="hit-sub">{{ h.sub }}</span>
              </button>
              <div v-if="!hits.length" class="hit-empty">没有匹配结果</div>
            </div>
          </div>
          <button class="ghost-btn" type="button" :aria-label="theme.isLight.value ? '切换为深色' : '切换为浅色'" @click="theme.toggle()">
            <TechIcon :name="theme.isLight.value ? 'moon' : 'sun'" :size="16" />
          </button>
          <div class="clock mono">{{ clock }}</div>
          <div class="user-chip">
            <span class="avatar">{{ (auth.user?.name || auth.user?.email || 'CG').slice(0, 2).toUpperCase() }}</span>
            <div class="user-meta">
              <strong>{{ auth.user?.name || '操作员' }}</strong>
              <span>{{ auth.role }}</span>
            </div>
            <button class="ghost-btn" @click="doLogout" aria-label="退出"><TechIcon name="logout" :size="16" /></button>
          </div>
        </div>
      </header>

      <main class="content" :class="{ 'content-deck': isPanorama }">
        <div v-if="!isPanorama && ws.loading && !ws.data" class="loading-screen">
          <div class="loader-ring"></div>
          <span>正在读取工作区数据…</span>
        </div>
        <div v-if="!isPanorama && ws.error" class="workspace-error" role="alert">{{ ws.error }} <button @click="ws.load(true).catch(() => {})">重试</button></div>
        <RouterView v-if="isPanorama || !ws.loading || ws.data" v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </RouterView>
      </main>
    </div>
  </div>
</template>

<style scoped>
.shell { display: grid; grid-template-columns: var(--sidebar) 1fr; height: 100dvh; transition: grid-template-columns var(--dur) var(--ease); }
.shell.collapsed { --sidebar: 72px; }
.scrim { display: none; }

.sidebar {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: var(--bg-deep);
  border-right: 1px solid var(--line);
  padding: 16px 12px;
  gap: 4px;
  z-index: 20;
}

.brand { display: flex; align-items: center; gap: 10px; padding: 6px 8px 18px; }
.brand-mark {
  width: 32px; height: 32px; flex: none; display: grid; place-items: center;
  border-radius: var(--r-lg); background: var(--brand-soft); color: var(--brand); border: 1px solid var(--line-bright);
}
.brand-text { display: flex; flex-direction: column; line-height: 1.2; min-width: 0; }
.brand-text strong { font-size: var(--fs-14); color: var(--text-strong); letter-spacing: -0.01em; font-weight: 650; }
.brand-text span { font-size: var(--fs-11); color: var(--text-faint); margin-top: 1px; }
.collapsed .brand-text,
.collapsed .nav-label,
.collapsed .nav-group,
.collapsed .side-foot .svc div,
.collapsed .nav-badge { display: none; }

.nav {
  flex: 1 1 auto;
  min-height: 0;
  padding: var(--sp-1) var(--sp-2) var(--sp-3);
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
  position: relative;
  z-index: 2;
}
.nav-group {
  padding: 14px 8px 6px;
  font-family: var(--font-mono);
  font-size: var(--fs-11);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-mute);
}
.nav-group:first-child { padding-top: 6px; }
.nav-item {
  position: relative; display: flex; align-items: center; gap: 10px;
  padding: 8px 10px; border-radius: var(--r);
  color: var(--text-mute); font-size: var(--fs-13);
  transition: background var(--dur-fast), color var(--dur-fast);
  width: 100%; text-align: left; cursor: pointer; pointer-events: auto;
}
.nav-item:hover { background: var(--bg-elev); color: var(--text); }
.nav-item.router-link-active { background: var(--brand-soft); color: var(--brand); font-weight: var(--fw-medium); }
.nav-item.router-link-active::before {
  content: ""; position: absolute; left: calc(-1 * var(--sp-2)); top: 8px; bottom: 8px;
  width: 2px; background: var(--brand); border-radius: 1px;
}
.nav-ico { display: grid; place-items: center; flex: none; }
.nav-label { font-size: var(--fs-13); font-weight: inherit; flex: 1; }
.nav-badge {
  margin-left: auto;
  font-size: var(--fs-11); font-family: var(--font-mono); font-variant-numeric: tabular-nums;
  color: var(--text-faint);
}
.nav-item.router-link-active .nav-badge { color: var(--brand); }

.side-foot {
  flex: none;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-3);
  border-top: 1px solid var(--line);
  position: relative;
  z-index: 1;
}
.svc { display: flex; align-items: center; gap: var(--sp-2); flex: 1; min-width: 0; }
.svc div { line-height: var(--lh-tight); min-width: 0; }
.svc strong { display: block; font-size: var(--fs-12); color: var(--text); font-weight: var(--fw-medium); }
.svc span { font-size: var(--fs-11); font-family: var(--font-mono); color: var(--text-faint); }
.collapse {
  flex: none;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: var(--r-sm);
  border: 1px solid var(--line);
  color: var(--text-faint);
  transition: color var(--dur-fast), border-color var(--dur-fast), background var(--dur-fast);
}
.collapse:hover { color: var(--brand); border-color: var(--line-bright); background: var(--bg-elev); }
.collapsed .collapse svg { transform: rotate(180deg); }

.main { display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow: hidden; }
.topbar {
  height: var(--topbar); flex: none; display: flex; align-items: center; justify-content: space-between;
  gap: var(--sp-4); padding: 0 var(--sp-6); border-bottom: 1px solid var(--line);
  background: var(--bg-base);
}
.topbar-left { display: flex; align-items: center; gap: var(--sp-3); }
.crumb { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--fs-13); color: var(--text-mute); }
.crumb-root { color: var(--text-mute); }
.crumb-now { color: var(--text-strong); font-weight: var(--fw-medium); }
.topbar-right { display: flex; align-items: center; gap: var(--sp-3); }
.search-wrap { position: relative; }
.search {
  display: flex; align-items: center; gap: var(--sp-2); height: 32px; padding: 0 10px;
  border-radius: var(--r); background: var(--surface-2);
  border: 1px solid var(--line); color: var(--text-faint); width: 240px;
}
.search:focus-within { border-color: var(--line-bright); box-shadow: 0 0 0 3px var(--brand-soft); background: var(--surface); }
.search:focus-within input { color: var(--text-strong); }
.search input { background: none; border: none; outline: none; color: var(--text); font-size: var(--fs-13); flex: 1; min-width: 0; }
.hits {
  position: absolute; top: calc(100% + 6px); left: 0; width: 360px;
  background: var(--surface); border: 1px solid var(--line);
  border-radius: var(--r); box-shadow: var(--shadow-panel); z-index: 30; overflow: hidden;
}
.hit {
  width: 100%; display: grid; grid-template-columns: 44px 1fr auto; gap: var(--sp-2); align-items: center;
  padding: var(--sp-2) var(--sp-3); text-align: left; color: var(--text); border-bottom: 1px solid var(--line);
}
.hit:hover { background: var(--bg-elev); }
.hit-kind { font-size: var(--fs-11); letter-spacing: 0; color: var(--brand); }
.hit-title { font-size: var(--fs-13); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hit-sub { font-size: var(--fs-11); color: var(--text-faint); }
.hit-empty { padding: var(--sp-4); color: var(--text-faint); font-size: var(--fs-12); text-align: center; }
.clock { font-size: var(--fs-12); color: var(--text-mute); letter-spacing: 0.02em; font-variant-numeric: tabular-nums; }
.user-chip { display: flex; align-items: center; gap: var(--sp-2); height: 32px; padding: 0 var(--sp-2); }
.avatar {
  width: 26px; height: 26px; border-radius: var(--r); display: grid; place-items: center;
  background: var(--brand-soft); color: var(--brand); font-weight: var(--fw-semibold); font-size: var(--fs-11);
  flex: none; border: 1px solid var(--line-bright);
}
.user-meta { line-height: var(--lh-tight); }
.user-meta strong { display: block; font-size: var(--fs-12); color: var(--text-strong); }
.user-meta span { font-size: var(--fs-11); color: var(--text-faint); text-transform: capitalize; }
.ghost-btn {
  display: grid; place-items: center; width: 32px; height: 32px;
  border-radius: var(--r); border: 1px solid var(--line); color: var(--text-faint);
  transition: color var(--dur-fast), border-color var(--dur-fast), background var(--dur-fast);
}
.ghost-btn:hover { color: var(--brand-bright); border-color: var(--line-bright); }
.mobile-menu { display: none; }

.content {
  flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column;
  overflow: hidden; padding: var(--sp-6); position: relative;
  background: var(--bg-void);
}
.content :deep(.page),
.content :deep(.pano),
.content :deep(.deck) {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
}
.content-deck { padding: 0; overflow-x: hidden; overflow-y: auto; }
.content-deck :deep(.pano),
.content-deck :deep(.deck) {
  height: 100%;
  max-height: 100%;
}

.shell.deck-full {
  grid-template-columns: 1fr;
}
.shell.deck-full .sidebar,
.shell.deck-full .topbar,
.shell.deck-full .scrim { display: none; }
.shell.deck-full .content,
.shell.deck-full .content-deck {
  padding: 0;
  height: 100dvh;
  max-height: 100dvh;
}

.loading-screen { height: 100%; display: grid; place-content: center; gap: var(--sp-4); justify-items: center; color: var(--text-mute); }
.loader-ring {
  width: 36px; height: 36px; border-radius: 50%;
  border: 2px solid var(--line); border-top-color: var(--brand);
  animation: spin 0.9s linear infinite;
}

@media (max-width: 880px) {
  .shell { grid-template-columns: 1fr; }
  .sidebar { display: none; }
  .shell.mobile-open .sidebar {
    display: flex; position: fixed; inset: 0 auto 0 0; width: min(280px, 86vw); z-index: 40;
  }
  .shell.mobile-open .scrim { display: block; position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 30; }
  .mobile-menu { display: grid; }
  .search { width: 180px; }
  .hits { width: 260px; right: 0; left: auto; }
}
.workspace-error { padding: .7rem; margin-bottom: .7rem; color: var(--cinnabar); background: var(--cinnabar-soft); }
.workspace-error button { text-decoration: underline; margin-left: .5rem; }
@media (max-width: 600px) {
  .topbar { padding: 0 12px; gap: 8px; }
  .topbar-left, .topbar-right { gap: 6px; min-width: 0; }
  .search-wrap, .clock, .user-meta, .crumb-root, .crumb > svg { display: none; }
  .content { padding: 12px; overflow-y: auto; }
}
</style>
