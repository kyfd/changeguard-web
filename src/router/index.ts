import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/workspace'

const routes: RouteRecordRaw[] = [
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { public: true, title: '登录' } },
  {
    path: '/',
    component: () => import('@/views/AppShell.vue'),
    children: [
      { path: '', redirect: { name: 'panorama' } },
      { path: 'panorama', name: 'panorama', component: () => import('@/views/PanoramaView.vue'), meta: { title: '总览', icon: 'activity' } },
      { path: 'dashboard', name: 'dashboard', component: () => import('@/views/DashboardView.vue'), meta: { title: '工作台', icon: 'gauge' } },
      { path: 'changes', name: 'changes', component: () => import('@/views/ChangesView.vue'), meta: { title: '变更工单', icon: 'code' } },
      { path: 'changes/:id', name: 'change-detail', component: () => import('@/views/ChangeDetailView.vue'), meta: { title: '变更详情', icon: 'code' } },
      { path: 'approvals', name: 'approvals', component: () => import('@/views/ApprovalsView.vue'), meta: { title: '审批中心', icon: 'check-circle' } },
      { path: 'risks', name: 'risks', component: () => import('@/views/RisksView.vue'), meta: { title: '风险中心', icon: 'shield-alert' } },
      { path: 'policies', name: 'policies', component: () => import('@/views/PoliciesView.vue'), meta: { title: '治理规则', icon: 'shield' } },
      { path: 'apps', name: 'apps', component: () => import('@/views/AppsView.vue'), meta: { title: '纳管服务', icon: 'server' } },
      { path: 'audits', name: 'audits', component: () => import('@/views/AuditsView.vue'), meta: { title: '审计日志', icon: 'scroll-text' } },
      { path: 'settings', name: 'settings', component: () => import('@/views/SettingsView.vue'), meta: { title: '系统设置', icon: 'settings' } },
      { path: ':pathMatch(.*)*', redirect: { name: 'dashboard' } },
    ],
  },
]

const router = createRouter({ history: createWebHashHistory(), routes })

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.ready) await auth.init()
  if (!to.meta.public && !auth.isAuthenticated) return { name: 'login' }
  if (to.name === 'login' && auth.isAuthenticated) return { name: 'panorama' }
  return true
})

router.afterEach((to) => {
  const t = (to.meta.title as string) || ''
  document.title = t ? `${t} · ChangeGuard` : 'ChangeGuard'
})

export default router
