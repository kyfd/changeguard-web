import test from 'node:test'
import assert from 'node:assert/strict'

globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}
const { api, APIError } = await import('../src/api/client.ts')

const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  })

async function withAPI(overrides, run) {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (path) => {
    if (Object.hasOwn(overrides, path)) {
      const response = overrides[path]
      if (response instanceof Error) throw response
      return response.clone()
    }
    if (path === '/api/passports') return json([])
    return json([])
  }
  try {
    await run()
  } finally {
    globalThis.fetch = originalFetch
  }
}

test('successful empty auxiliary sources are not marked unavailable', async () => {
  await withAPI({}, async () => {
    const result = await api.loadWorkspace()
    assert.deepEqual(result.unavailableSources, [])
    assert.deepEqual(result.apps, [])
    assert.deepEqual(result.changes, [])
  })
})

test('partial source failures keep changes and identify unavailable data', async () => {
  await withAPI(
    {
      '/api/changes': json([
        { id: 'loaded-change', status: 'APPROVED', risk: 'LOW' },
      ]),
      '/api/apps': json({ error: 'unavailable' }, 503),
      '/api/policies': new TypeError('network disconnected'),
      '/api/audits?limit=250': json({ error: 'denied' }, 403),
    },
    async () => {
      const result = await api.loadWorkspace()
      assert.deepEqual(result.unavailableSources, [
        'apps',
        'audits',
        'policies',
      ])
      assert.equal(result.changes[0].id, 'loaded-change')
      assert.equal(result.changes[0].status, 'APPROVED')
      assert.deepEqual(result.apps, [])
    },
  )
})

test('authentication failure is not converted to a partial snapshot', async () => {
  await withAPI(
    { '/api/apps': json({ error: 'unauthorized' }, 401) },
    async () => {
      await assert.rejects(
        api.loadWorkspace(),
        (error) => error instanceof APIError && error.status === 401,
      )
    },
  )
})

test('primary changes failure prevents a successful snapshot', async () => {
  await withAPI(
    { '/api/changes': json({ error: 'unavailable' }, 503) },
    async () => {
      await assert.rejects(
        api.loadWorkspace(),
        (error) => error instanceof APIError && error.status === 503,
      )
    },
  )
})
