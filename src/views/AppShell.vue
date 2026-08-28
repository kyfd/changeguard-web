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
    label: '观测',
    items: [
      { to: 'panorama', label: '治理全景', icon: 'activity' },
      { to: 'dashboard', label: '工作台', icon: 'gauge' },
    ],
  },
  {
    label: '治理',
    items: [
      { to: 'changes', label: '变更工单', icon: 'code' },
      { to: 'approvals', label: '审批中心', icon: 'check-circle' },
      { to: 'risks', label: '风险中心', icon: 'shield-alert' },
    ],
  },
  {
    label: '资产',
    items: [
      { to: 'policies', label: '治理规则', icon: 'shield' },
      { to: 'apps', label: '纳管服务', icon: 'server' },
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
        <div class="brand-mark" aria-hidden="true"><BrandLogo :size="26" /></div>
        <div class="brand-text">
          <strong>ChangeGuard</strong>
          <span>变更风险治理</span>
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
            <span class="nav-ico"><TechIcon :name="item.icon" :size="17" /></span>
            <span class="nav-label">{{ item.label }}</span>
            <span v-if="item.to === 'approvals' && pendingCount" class="nav-badge">{{ pendingCount }}</span>
          </button>
        </template>
      </nav>

      <div class="side-foot">
        <div class="svc">
          <span class="dot dot-ok" aria-hidden="true"></span>
          <div><strong>服务正常</strong><span>治理引擎在线</span></div>
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
            <span class="crumb-root display">ChangeGuard</span>
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
        <div v-if="ws.loading && !ws.data" class="loading-screen">
          <div class="loader-ring"></div>
          <span>正在同步治理数据…</span>
        </div>
        <RouterView v-else v-slot="{ Component }">
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
  background: var(--bg-glass-strong);
  border-right: 1px solid var(--line);
  backdrop-filter: blur(18px);
  z-index: 20;
}

.brand { display: flex; align-items: center; gap: 0.75rem; padding: 1.05rem 1.1rem; }
.brand-mark {
  width: 40px; height: 40px; flex: none; display: grid; place-items: center;
  border-radius: 8px; background: var(--brand-soft); color: var(--brand-bright); border: 1px solid var(--line-bright);
}
.brand-text { display: flex; flex-direction: column; line-height: 1.2; min-width: 0; }
.brand-text strong { font-size: 0.95rem; color: var(--text-strong); letter-spacing: 0; font-weight: 650; }
.brand-text span { font-size: 0.7rem; color: var(--text-faint); margin-top: 0.18rem; }
.collapsed .brand-text,
.collapsed .nav-label,
.collapsed .nav-group,
.collapsed .side-foot .svc div,
.collapsed .nav-badge { display: none; }

.nav {
  flex: 1 1 auto;
  min-height: 0;
  padding: 0.35rem 0.55rem 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
  position: relative;
  z-index: 2;
}
.nav-group {
  margin: 0.9rem 0.85rem 0.28rem;
  font-size: 0.68rem; letter-spacing: 0;
  color: var(--text-faint); font-weight: 500;
}
.nav-group:first-child { margin-top: 0.15rem; }
.nav-item {
  position: relative; display: flex; align-items: center; gap: 0.7rem;
  padding: 0.62rem 0.8rem 0.62rem 0.85rem; border-radius: 6px;
  color: var(--text-mute); transition: color var(--dur), background var(--dur);
  width: 100%; text-align: left; cursor: pointer; pointer-events: auto;
}
.nav-item:hover { color: var(--text); background: var(--surface-2); }
.nav-item.router-link-active { color: var(--text-strong); background: var(--gold-soft); }
.nav-item.router-link-active::before {
  content: ""; position: absolute; left: 0; top: 22%; bottom: 22%;
  width: 2px; background: var(--gold); border-radius: 1px;
}
.nav-item.router-link-active .nav-ico { color: var(--gold); }
.nav-ico { display: grid; place-items: center; flex: none; }
.nav-label { font-size: 0.92rem; font-weight: 500; flex: 1; }
.nav-badge {
  font-size: 0.66rem; font-family: var(--font-mono); padding: 0.1em 0.5em;
  border-radius: var(--r-sm); background: var(--cinnabar-soft); color: var(--red-bright);
  border: 1px solid rgba(196, 92, 74, 0.28);
}

.side-foot {
  flex: none;
  padding: 0.85rem 0.9rem;
  border-top: 1px solid var(--line);
  background: var(--bg-elev);
  position: relative;
  z-index: 1;
}
.svc { display: flex; align-items: center; gap: 0.6rem; }
.svc div { line-height: 1.25; }
.svc strong { display: block; font-size: 0.8rem; color: var(--text); }
.svc span { font-size: 0.68rem; color: var(--text-faint); }
.collapse {
  margin-top: 0.55rem; width: 100%; display: grid; place-items: center;
  padding: 0.38rem; border-radius: var(--r-sm); color: var(--text-faint);
}
.collapse:hover { color: var(--gold); background: var(--surface-2); }
.collapsed .collapse svg { transform: rotate(180deg); }

.main { display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow: hidden; }
.topbar {
  height: var(--topbar); flex: none; display: flex; align-items: center; justify-content: space-between;
  padding: 0 1.5rem; border-bottom: 1px solid var(--line);
  background: var(--bg-elev);
}
.topbar-left { display: flex; align-items: center; gap: 0.85rem; }
.crumb { display: flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; color: var(--text-mute); }
.crumb-root { opacity: 0.55; font-size: 0.82rem; }
.crumb-now { color: var(--text-strong); font-weight: 600; font-size: 0.95rem; }
.topbar-right { display: flex; align-items: center; gap: 0.85rem; }
.search-wrap { position: relative; }
.search {
  display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.85rem;
  border-radius: var(--r); background: var(--surface);
  border: 1px solid var(--line); color: var(--text-mute); width: 280px;
}
.search:focus-within { border-color: var(--line-bright); box-shadow: 0 0 0 3px var(--gold-soft); }
.search input { background: none; border: none; outline: none; color: var(--text); font-size: 0.88rem; flex: 1; min-width: 0; }
.hits {
  position: absolute; top: calc(100% + 6px); left: 0; width: 360px;
  background: var(--bg-elev); border: 1px solid var(--line-bright);
  border-radius: var(--r); box-shadow: var(--shadow-panel); z-index: 30; overflow: hidden;
}
.hit {
  width: 100%; display: grid; grid-template-columns: 44px 1fr auto; gap: 0.55rem; align-items: center;
  padding: 0.55rem 0.75rem; text-align: left; color: var(--text); border-bottom: 1px solid var(--line);
}
.hit:hover { background: var(--gold-soft); }
.hit-kind { font-size: 0.7rem; letter-spacing: 0; color: var(--gold); }
.hit-title { font-size: 0.84rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hit-sub { font-size: 0.72rem; color: var(--text-faint); }
.hit-empty { padding: 0.8rem; color: var(--text-faint); font-size: 0.78rem; text-align: center; }
.clock { font-size: 0.8rem; color: var(--text-mute); letter-spacing: 0.04em; }
.user-chip { display: flex; align-items: center; gap: 0.55rem; padding: 0.2rem 0.35rem 0.2rem 0.45rem; }
.avatar {
  width: 28px; height: 28px; border-radius: 6px; display: grid; place-items: center;
  background: var(--gold-soft); color: var(--gold-bright); font-weight: 600; font-size: 0.7rem;
  flex: none; border: 1px solid var(--line-bright);
}
.user-meta { line-height: 1.2; }
.user-meta strong { display: block; font-size: 0.8rem; color: var(--text-strong); }
.user-meta span { font-size: 0.68rem; color: var(--text-faint); text-transform: capitalize; }
.ghost-btn { display: grid; place-items: center; width: 30px; height: 30px; border-radius: var(--r-sm); color: var(--text-mute); }
.ghost-btn:hover { color: var(--gold-bright); background: var(--surface-2); }
.mobile-menu { display: none; }

.content {
  flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column;
  overflow: hidden; padding: 1.4rem 1.7rem; position: relative;
  background: var(--bg-void);
}
.content :deep(.page),
.content :deep(.pano),
.content :deep(.deck) {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
}
.content-deck { padding: 0; overflow: hidden; }
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

.loading-screen { height: 100%; display: grid; place-content: center; gap: 0.9rem; justify-items: center; color: var(--text-mute); }
.loader-ring {
  width: 36px; height: 36px; border-radius: 50%;
  border: 2px solid var(--line); border-top-color: var(--gold);
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
</style>
