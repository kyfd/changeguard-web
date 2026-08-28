import { computed, onMounted, onBeforeUnmount, ref } from 'vue'

export type ThemePref = 'dark' | 'light' | 'system'
const KEY = 'changeguard-theme'
const pref = ref<ThemePref>('light')
const resolved = ref<'dark' | 'light'>('light')

function readPref(): ThemePref {
  const v = localStorage.getItem(KEY)
  return v === 'light' || v === 'system' || v === 'dark' ? v : 'light'
}

function resolve(p: ThemePref): 'dark' | 'light' {
  if (p === 'system') {
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }
  return p
}

function paint(p: ThemePref) {
  pref.value = p
  const next = resolve(p)
  resolved.value = next
  const root = document.documentElement
  root.setAttribute('data-theme', next)
  root.style.colorScheme = next
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', next === 'light' ? '#f6f7f9' : '#14161c')
  const scheme = document.querySelector('meta[name="color-scheme"]')
  if (scheme) scheme.setAttribute('content', next)
}

export function applyStoredTheme() {
  paint(readPref())
}

export function useTheme() {
  let mq: MediaQueryList | null = null
  function onSys() { if (pref.value === 'system') paint('system') }

  onMounted(() => {
    paint(readPref())
    mq = window.matchMedia?.('(prefers-color-scheme: light)') || null
    mq?.addEventListener?.('change', onSys)
  })
  onBeforeUnmount(() => mq?.removeEventListener?.('change', onSys))

  function setPref(p: ThemePref) {
    localStorage.setItem(KEY, p)
    paint(p)
  }
  function toggle() {
    setPref(resolved.value === 'dark' ? 'light' : 'dark')
  }

  return {
    pref,
    resolved,
    isLight: computed(() => resolved.value === 'light'),
    setPref,
    toggle,
  }
}
