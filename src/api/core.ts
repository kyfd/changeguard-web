import type { Change, Passport, Session } from './types'
import { listFrom, normalizePassport } from './normalizers.ts'

const ACTOR_KEY = 'changeguard_actor'
let csrfToken = ''
let actorId = typeof localStorage !== 'undefined' ? localStorage.getItem(ACTOR_KEY) || '' : ''

export class APIError extends Error {
  status: number
  payload: any
  constructor(message: string, status: number, payload: any) {
    super(message || '请求失败')
    this.name = 'APIError'
    this.status = status
    this.payload = payload
  }
}

export function setSession(session: Session | null) {
  csrfToken = session?.csrf_token || ''
  if (session?.user?.id) {
    actorId = session.user.id
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ACTOR_KEY, actorId)
    }
  } else {
    actorId = ''
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(ACTOR_KEY)
    }
  }
}

export async function request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }
  if (options.body != null && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken
  if (actorId) headers['X-Actor-ID'] = actorId

  const res = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...options, headers })
  const ct = res.headers.get('content-type') || ''
  let payload: any = null
  if (res.status !== 204) {
    if (ct.includes('json')) {
      payload = await res.json().catch(() => null)
    } else {
      payload = await res.text().catch(() => '')
    }
  }
  if (!res.ok) {
    const msg =
      payload?.error ||
      payload?.message ||
      (typeof payload === 'string' && payload) ||
      `请求失败（HTTP ${res.status}）`
    throw new APIError(msg, res.status, payload)
  }
  return payload as T
}

export async function optional<T = any>(
  paths: string[]
): Promise<{ supported: boolean; path: string; data: T | null }> {
  for (const p of paths) {
    try {
      return { supported: true, path: p, data: await request<T>(p) }
    } catch (e: any) {
      if (e?.status !== 404 && e?.status !== 405) throw e
    }
  }
  return { supported: false, path: '', data: null }
}

export async function soft<T = any>(path: string, fallback: T): Promise<T> {
  try {
    return await request<T>(path)
  } catch (e: any) {
    if (e?.status === 401) throw e
    return fallback
  }
}

export async function loadPassports(changes: Change[]) {
  const globalResult = await optional(['/api/passports', '/api/gate/passports', '/api/ci/passports'])
  if (globalResult.supported && globalResult.data) {
    const raw: any = globalResult.data
    const items: any[] = listFrom(raw, ['passports', 'items', 'data'])
    const byChange = new Map(changes.map((c) => [c.id, c]))
    return {
      supported: true,
      path: globalResult.path,
      items: items.map((i) => normalizePassport(i, byChange.get(i.change_id || i.aggregate_id))),
    }
  }

  const rows = await Promise.all(
    changes.map(async (c) => {
      try {
        const r = await optional([`/api/changes/${encodeURIComponent(c.id)}/passports`])
        if (!r.supported) return { supported: false, items: [] as Passport[] }
        return {
          supported: true,
          items: listFrom(r.data, ['passports', 'items', 'data']).map((i: any) => normalizePassport(i, c)),
        }
      } catch (e: any) {
        if (e?.status === 401) throw e
        return { supported: true, items: [] as Passport[] }
      }
    })
  )
  const items = rows.flatMap((r) => r.items)
  const supported = rows.some((r) => r.supported)
  return { supported, path: supported ? '/api/changes/{id}/passports' : '', items }
}
