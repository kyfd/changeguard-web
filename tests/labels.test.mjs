import test from 'node:test'
import assert from 'node:assert/strict'
import { STATUS_LABEL, stepIndex, consumptionStats, passportStepLabel, checkSummary } from '../src/lib/labels.ts'

test('approval and rejection do not mean passport consumed', () => {
  assert.equal(STATUS_LABEL.COMPLETED, '通行证已消费')
  assert.equal(STATUS_LABEL.APPROVED, '已批准')
  assert.equal(stepIndex('REJECTED'), stepIndex('WAITING_APPROVAL'))
  assert.equal(passportStepLabel('consume', 'APPROVED', ''), '待 CI 消费')
  assert.equal(passportStepLabel('consume', 'COMPLETED', ''), '已消费')
})

test('consumption counts only COMPLETED among loaded changes', () => {
  assert.deepEqual(consumptionStats([]), { consumed: 0, total: 0, percent: 0 })
  assert.deepEqual(consumptionStats(['APPROVED', 'COMPLETED', 'REJECTED', 'DRAFT'].map(status => ({ status }))), { consumed: 1, total: 4, percent: 25 })
})

test('check run, not empty findings or finding resolution, determines summary', () => {
  assert.equal(checkSummary({ findings: [], check_run: { status: 'PASSED', blocking: 0 } }), '最近规则检查通过，无阻断项')
  assert.match(checkSummary({ findings: [{ status: 'RESOLVED' }], check_run: { status: 'FAILED', blocking: 2 } }), /2 项阻断/)
  assert.equal(checkSummary({ findings: [] }), '暂无规则检查记录')
  assert.notEqual(checkSummary({ check_run: { status: 'PASSED' } }), '最近规则检查通过，无阻断项')
})
