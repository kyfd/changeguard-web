import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api, setSession, onSoftError, APIError } from '@/api/client'
import type { Workspace, Session } from '@/api/types'

/* 认证 store */
export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const ready = ref(false)
  const isAuthenticated = computed(() => Boolean(session.value?.user?.id))
  const user = computed(() => session.value?.user || null)
  const role = computed(() => String(user.value?.role || 'viewer'))

  async function init() {
    try {
      const s = await api.session()
      session.value = s
      setSession(s)
    } catch (e) {
      session.value = null
    } finally {
      ready.value = true
    }
  }

  async function login(email: string, password: string) {
    const s = await api.login({ email, password })
    session.value = s
    setSession(s)
    return s
  }

  async function register(payload: any) {
    return api.register(payload)
  }

  async function acceptInvite(payload: any) {
    return api.acceptInvite(payload)
  }

  async function logout() {
    try { await api.logout() } catch {}
    session.value = null
    setSession(null)
  }

  return { session, ready, isAuthenticated, user, role, init, login, register, acceptInvite, logout }
})

/* 工作区全量数据 store */
export const useWorkspaceStore = defineStore('workspace', () => {
  const data = ref<Workspace | null>(null)
  const loading = ref(false)
  const error = ref('')
  const loadedAt = ref(0)
  /** 全量加载中降级为空数据的接口（"接口: 原因"），每次全量加载后替换为本次结果。 */
  const workspaceErrors = ref<string[]>([])
  /** 工作区之外的 soft 调用（如模型用量）失败，独立保存，不被全量加载覆盖。 */
  const auxErrors = ref<string[]>([])
  const loadErrors = computed(() => [...workspaceErrors.value, ...auxErrors.value.filter(e => !workspaceErrors.value.includes(e))])

  onSoftError(entry => { if (!auxErrors.value.includes(entry)) auxErrors.value.push(entry) })

  const changes = computed(() => data.value?.changes || [])
  const apps = computed(() => data.value?.apps || [])
  const users = computed(() => data.value?.users || [])
  const policies = computed(() => data.value?.policies || [])
  const audits = computed(() => data.value?.audits || [])
  const dashboard = computed(() => data.value?.dashboard || null)

  let activeLoad: Promise<void> | null = null
  let reloadQueued = false

  async function load(force = false) {
    if (loading.value && activeLoad) {
      if (force) reloadQueued = true
      return activeLoad
    }
    if (data.value && !force && Date.now() - loadedAt.value < 20000) return
    loading.value = true
    error.value = ''
    activeLoad = (async () => {
      try {
        const errors: string[] = []
        data.value = await api.loadWorkspace(errors)
        workspaceErrors.value = errors
        loadedAt.value = Date.now()
      } catch (e: any) {
        error.value = e instanceof APIError ? e.message : '数据加载失败'
        workspaceErrors.value = [] // 整体失败由 error 呈现，不再显示上一轮的局部告警
        throw e
      } finally {
        loading.value = false
        activeLoad = null
      }
    })()
    try {
      await activeLoad
    } finally {
      if (reloadQueued) {
        reloadQueued = false
        await load(true)
      }
    }
  }

  function replaceChange(change: any) {
    if (!data.value || !change?.id) return
    const index = data.value.changes.findIndex(item => item.id === change.id)
    if (index >= 0) data.value.changes.splice(index, 1, change)
    else data.value.changes.unshift(change)
  }

  function clear() { data.value = null; loadedAt.value = 0; error.value = ''; workspaceErrors.value = []; auxErrors.value = [] }

  return { data, loading, error, loadErrors, loadedAt, changes, apps, users, policies, audits, dashboard, load, replaceChange, clear }
})
