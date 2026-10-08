import { describe, expect, it } from 'vitest'
import { createDefaultBatchDisplay, createDefaultBatchSort, metricIds, normalizeBatchDisplay } from '../src/domain/batch-display'
import { allMetricIds } from '../src/features/batch/columns'

describe('batch display preferences', () => {
  it('uses the current table catalog and gives each new session independent defaults', () => {
    expect(metricIds).toEqual(allMetricIds)
    const defaults = createDefaultBatchDisplay()
    expect(defaults).toEqual({ visible: [...metricIds] })
    defaults.visible.pop()
    expect(createDefaultBatchDisplay().visible).toHaveLength(6)
    const sort = createDefaultBatchSort()
    expect(sort).toEqual({ key: 'materialWeight', direction: 'asc' })
    sort.direction = 'desc'
    expect(createDefaultBatchSort().direction).toBe('asc')
  })
  it('retains empty selections, deduplicates known fields and tolerates future removed fields', () => {
    expect(normalizeBatchDisplay({ visible: [] }).visible).toEqual([])
    expect(normalizeBatchDisplay({ visible: ['volume', 'unknown', 'volume', 'length'] }).visible).toEqual(['volume', 'length'])
    expect(normalizeBatchDisplay({ visible: ['unknown'] }).visible).toEqual(createDefaultBatchDisplay().visible)
  })
  it('keeps only visible columns and excludes transient sorting and unrelated settings', () => {
    expect(normalizeBatchDisplay(null)).toEqual(createDefaultBatchDisplay())
    expect(normalizeBatchDisplay({ visible: 'invalid', sort: { key: 'volume', direction: 'sideways' }, weightUnit: 'oz' }))
      .toEqual(createDefaultBatchDisplay())
    expect(normalizeBatchDisplay({ visible: ['length'], sort: { key: 'volume', direction: 'desc' } })).toEqual({ visible: ['length'] })
    expect(normalizeBatchDisplay({ sort: { key: 'removed-column', direction: 'desc' } })).toEqual(createDefaultBatchDisplay())
  })
})
