import { describe, expect, it } from 'vitest'
import { createDefaultBatchDisplay, metricIds, normalizeBatchDisplay } from '../src/domain/batch-display'
import { allMetricIds } from '../src/features/batch/columns'

describe('batch display preferences', () => {
  it('uses the current table catalog and gives each new session independent defaults', () => {
    expect(metricIds).toEqual(allMetricIds)
    const defaults = createDefaultBatchDisplay()
    expect(defaults).toEqual({ visible: ['volume', 'materialWeight', 'batWeight'], sort: { key: 'name', direction: 'asc' } })
    defaults.visible.pop(); defaults.sort.direction = 'desc'
    expect(createDefaultBatchDisplay().visible).toHaveLength(3)
    expect(createDefaultBatchDisplay().sort.direction).toBe('asc')
  })
  it('retains empty selections, deduplicates known fields and tolerates future removed fields', () => {
    expect(normalizeBatchDisplay({ visible: [] }).visible).toEqual([])
    expect(normalizeBatchDisplay({ visible: ['volume', 'unknown', 'volume', 'length'] }).visible).toEqual(['volume', 'length'])
    expect(normalizeBatchDisplay({ visible: ['unknown'] }).visible).toEqual(createDefaultBatchDisplay().visible)
  })
  it('recovers invalid fields independently and never includes material settings or units', () => {
    expect(normalizeBatchDisplay(null)).toEqual(createDefaultBatchDisplay())
    expect(normalizeBatchDisplay({ visible: 'invalid', sort: { key: 'volume', direction: 'sideways' }, weightUnit: 'oz' }))
      .toEqual({ visible: ['volume', 'materialWeight', 'batWeight'], sort: { key: 'volume', direction: 'asc' } })
    expect(normalizeBatchDisplay({ sort: { key: 'removed-column', direction: 'desc' } }).sort).toEqual({ key: 'name', direction: 'desc' })
  })
})
