import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildPanorama,
  changeTime,
  stageOf,
  PANORAMA_STAGES,
} from '../src/lib/panorama.ts'

const change = (id, values = {}) => ({
  id,
  status: 'DRAFT',
  risk: 'UNKNOWN',
  ...values,
})

test('every known and unknown state is counted exactly once', () => {
  const states = [
    ...PANORAMA_STAGES.flatMap((stage) => stage.statuses),
    'FUTURE_STATUS',
  ]
  const result = buildPanorama(
    states.map((status, index) => change(String(index), { status })),
    [],
  )
  assert.equal(result.total, 11)
  assert.equal(
    result.stages.reduce((sum, stage) => sum + stage.count, 0),
    states.length,
  )
  assert.equal(result.stages.find((stage) => stage.id === 'check').count, 3)
  assert.equal(result.stages.find((stage) => stage.id === 'verify').count, 2)
  assert.equal(result.stages.find((stage) => stage.id === 'unknown').count, 1)
  assert.equal(stageOf('FUTURE_STATUS'), 'unknown')
  assert.equal(result.consumed, 1)
  assert.equal(result.pending, 1)
  assert.equal(result.failed, 1)
})

test('risk distribution includes unrecognized risks and empty data is finite', () => {
  const result = buildPanorama(
    ['LOW', 'HIGH', 'MEDIUM', 'UNKNOWN', 'FUTURE_RISK'].map((risk, index) =>
      change(String(index), { risk }),
    ),
    [],
  )
  assert.equal(result.riskRows.find((row) => row.key === 'UNKNOWN').count, 2)
  assert.equal(
    result.riskRows.reduce((sum, row) => sum + row.count, 0),
    result.total,
  )
  const empty = buildPanorama([], [])
  assert.equal(empty.total, 0)
  assert.equal(empty.consumed, 0)
  assert.deepEqual(empty.services, [])
  assert.deepEqual(empty.rules, [])
})

test('services use stable ids without merging same-name, orphan, or unassigned changes', () => {
  const apps = [
    { id: 'a', name: '同名服务' },
    { id: 'b', name: '同名服务' },
  ]
  const changes = [
    change('1', { application_id: 'a' }),
    change('2', { application_id: 'b' }),
    change('3', { application_id: 'a' }),
    change('4', { application_id: 'orphan' }),
    change('5'),
    change('6', { application_name: '同名服务' }),
  ]
  const result = buildPanorama(changes, apps)
  assert.equal(result.services.length, 5)
  assert.equal(
    result.services.find((service) => service.id === 'id:a').count,
    2,
  )
  assert.equal(
    result.services.find((service) => service.id === 'id:b').count,
    1,
  )
  assert.equal(
    result.services.find((service) => service.id === 'name:同名服务').count,
    1,
  )
  assert.match(
    result.services.find((service) => service.id === 'id:orphan').name,
    /未登记/,
  )
  assert.equal(
    result.services.find((service) => service.id === 'unassigned').count,
    1,
  )
  assert.equal(
    result.services.reduce((sum, service) => sum + service.count, 0),
    changes.length,
  )
})

test('rule hit counts and recent changes do not mutate source data', () => {
  const input = [
    change('old', {
      updated_at: 'invalid',
      created_at: '2026-09-01',
      findings: [{ code: 'A', title: 'rule A' }],
    }),
    change('new', {
      updated_at: '2026-09-05',
      findings: [{ code: 'A' }, { code: 'B' }, {}],
    }),
  ]
  const original = structuredClone(input)
  const result = buildPanorama(input, [])
  assert.equal(result.recent[0].id, 'new')
  assert.equal(result.rules.find((rule) => rule.code === 'A').count, 2)
  assert.equal(
    result.rules.find((rule) => rule.code === 'UNCLASSIFIED').count,
    1,
  )
  assert.equal(changeTime(change('invalid', { updated_at: 'no date' })), 0)
  assert.deepEqual(input, original)
})
