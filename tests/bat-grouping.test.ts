import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { defaultBatGrouping, batGroupingStorage } from '../src/config/grouping'
import { batGroupRank, classifyBat, normalizeBatGrouping } from '../src/domain/bat-grouping'
import { createDefaultBatchDisplay } from '../src/domain/batch-display'
import { analyzeAnc } from '../src/domain/analyze'
import type { AnalysisEntry } from '../src/services/analysis-state'
import { readBatGrouping, saveBatGrouping } from '../src/services/bat-grouping-storage'
import { readMaterialSettings, saveMaterialSettings } from '../src/services/material-storage'
import { readLengthUnit, saveLengthUnit } from '../src/services/length-unit-storage'
import { readWeightUnit, saveWeightUnit } from '../src/services/weight-unit-storage'
import { buildBatchView } from '../src/features/batch/view-model'
import { buildReportLayout } from '../src/reports/report-layout'
import { createExcelReport } from '../src/reports/excel-report'

const raw = readFileSync(new URL('./fixtures/case-001.anc', import.meta.url), 'utf8')
const result = analyzeAnc(raw, { name: 'fixture.anc', size: raw.length })
if (result.status !== 'calculated') throw new Error('Expected calculated fixture')
const base = result
function entry(id: string, diameter: number, volume: number, name = `${id}.anc`): AnalysisEntry {
  const source = { name, size: raw.length }
  return { id, source, state: { status: 'result', result: { ...base, source, volumeCm3: volume,
    dimensions: { ...base.dimensions, maximumDiameterMm: diameter } } } }
}
const pending: AnalysisEntry = { id: 'pending', source: { name: 'a-pending.anc', size: 1 }, state: { status: 'loading', source: { name: 'a-pending.anc', size: 1 } } }
const failed: AnalysisEntry = { id: 'failed', source: { name: 'z-failed.anc', size: 1 }, state: { status: 'result', result: { status: 'undetermined', source: { name: 'z-failed.anc', size: 1 }, code: 'missingHighEnd' } } }
const entries = [entry('base-large', 65, 500), pending, entry('soft-large', 58, 1000), failed, entry('base-small', 60, 100), entry('soft-small', 59, 900)]

describe('independent bat classification', () => {
  it('uses the full-precision retained diameter, including equality at the boundary', () => {
    expect(classifyBat(59.999, defaultBatGrouping)).toBe('softball')
    expect(classifyBat(60, defaultBatGrouping)).toBe('baseball')
    expect(classifyBat(60.001, defaultBatGrouping)).toBe('baseball')
    expect(classifyBat(60, { ...defaultBatGrouping, diameterThresholdMm: 60.01 })).toBe('softball')
  })
  it.each([null, NaN, Infinity, 0, -1])('leaves invalid diameter %s unclassified', diameter => {
    expect(classifyBat(diameter, defaultBatGrouping)).toBe('unclassified')
    expect(batGroupRank('unclassified', 'baseball')).toBe(2)
    expect(batGroupRank('unclassified', 'softball')).toBe(2)
  })
  it('recovers invalid preferences field by field, giving each reader independent defaults', () => {
    expect(normalizeBatGrouping({ diameterThresholdMm: 0, firstGroup: 'baseball' })).toEqual({ diameterThresholdMm: 60, firstGroup: 'baseball' })
    expect(normalizeBatGrouping({ diameterThresholdMm: 61.25, firstGroup: 'unknown' })).toEqual({ diameterThresholdMm: 61.25, firstGroup: 'softball' })
    const defaults = normalizeBatGrouping(null)
    defaults.diameterThresholdMm = 70
    expect(normalizeBatGrouping(null)).toEqual(defaultBatGrouping)
  })
})

describe('grouping before shared batch sorting', () => {
  it.each(['asc', 'desc'] as const)('keeps groups together regardless of %s numeric direction', direction => {
    const original = structuredClone(entries)
    const view = buildBatchView(entries, ['volume'], { key: 'volume', direction })
    expect(view.rows.map(row => row.id)).toEqual(direction === 'asc'
      ? ['soft-small', 'soft-large', 'base-small', 'base-large', 'pending', 'failed']
      : ['soft-large', 'soft-small', 'base-large', 'base-small', 'pending', 'failed'])
    expect(entries).toEqual(original)
  })
  it('swaps group priority without reversing either group or changing default session preferences', () => {
    const sort = { key: 'volume', direction: 'asc' } as const
    const view = buildBatchView(entries, ['volume'], sort, undefined, 'mm', { ...defaultBatGrouping, firstGroup: 'baseball' })
    expect(view.rows.map(row => row.id)).toEqual(['base-small', 'base-large', 'soft-small', 'soft-large', 'pending', 'failed'])
    expect(view.sort).toEqual(sort)
    expect(createDefaultBatchDisplay().sort).toEqual({ key: 'name', direction: 'asc' })
  })
  it('sorts names naturally within groups and never classifies by filename', () => {
    const view = buildBatchView([entry('a', 65, 100, '壘球2.anc'), entry('b', 58, 100, '棒球10.anc'), entry('c', 58, 100, '棒球2.anc')], [], { key: 'name', direction: 'desc' })
    expect(view.rows.map(row => row.id)).toEqual(['b', 'c', 'a'])
  })
  it('classifies on raw millimetres even with a hidden diameter column or matching rounded values', () => {
    const data = [entry('base', 60.001, 100), entry('soft', 59.999, 100)]
    const view = buildBatchView(data, ['length'], { key: 'name', direction: 'asc' }, undefined, 'both')
    expect(view.rows.map(row => row.id)).toEqual(['soft', 'base'])
    expect(view.rows[0].cells.maximumDiameter.display).toBe(view.rows[1].cells.maximumDiameter.display)
    const changed = buildBatchView(data, [], { key: 'name', direction: 'asc' }, undefined, 'in', { ...defaultBatGrouping, diameterThresholdMm: 61 })
    expect(changed.rows.map(row => row.id)).toEqual(['base', 'soft'])
    expect(changed.rows.map(row => row.cells.volume.value)).toEqual([100, 100])
  })
  it('retains lower/upper range comparison and natural filename ties in each group', () => {
    const data = [entry('wide', 58, 100, 'bat1.anc'), entry('tie10', 58, 100, 'bat10.anc'), entry('tie2', 58, 100, 'bat2.anc'), entry('base', 65, 100)]
    const view = buildBatchView(data, ['batWeight'], { key: 'batWeight', direction: 'asc' }, {
      material: { referenceDensity: null, volumeCm3: null, weightG: null, weightErrorPercent: null },
      requirements: { wide: { min: 600, max: 650 }, tie10: { min: 600, max: 640 }, tie2: { min: 600, max: 640 }, base: { min: 100, max: 100 } }, weightUnit: 'oz',
    })
    expect(view.rows.map(row => row.id)).toEqual(['tie2', 'tie10', 'wide', 'base'])
  })
  it('uses exactly the same grouping order in Excel and PDF layout, including hidden classification data', () => {
    const view = buildBatchView(entries, ['volume'], { key: 'volume', direction: 'desc' }, undefined, 'mm', { ...defaultBatGrouping, firstGroup: 'baseball' })
    const sheet = createExcelReport(view).worksheets[0]
    const layout = buildReportLayout(view, value => value.length * 10)
    view.rows.forEach((row, index) => expect(sheet.getCell(index + 2, 1).text).toContain(row.name))
    expect(layout.rows.map(row => row.row.id)).toEqual(view.rows.map(row => row.id))
  })
})

describe('grouping preference storage', () => {
  it('persists threshold and order independently of material, units and file-list defaults', () => {
    const values = new Map<string, string>()
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
    expect(readBatGrouping(storage).settings).toEqual(defaultBatGrouping)
    const settings = { diameterThresholdMm: 61.25, firstGroup: 'baseball' } as const
    expect(saveBatGrouping(storage, settings)).toBe(true)
    saveMaterialSettings(storage, { referenceDensity: 0.7, volumeCm3: 3000, weightG: 2100, weightErrorPercent: -3 })
    saveLengthUnit(storage, 'in'); saveWeightUnit(storage, 'both')
    const nextFiles = createDefaultBatchDisplay()
    expect(nextFiles.sort.key).toBe('name')
    expect(readBatGrouping(storage).settings).toEqual(settings)
    expect(readMaterialSettings(storage).settings.referenceDensity).toBe(0.7)
    expect(readLengthUnit(storage).mode).toBe('in')
    expect(readWeightUnit(storage).mode).toBe('both')
  })
  it('rejects invalid saves and safely recovers corrupt, future or blocked storage', () => {
    const values = new Map<string, string>()
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
    expect(saveBatGrouping(storage, { ...defaultBatGrouping, diameterThresholdMm: NaN })).toBe(false)
    values.set(batGroupingStorage.key, JSON.stringify({ version: 1, settings: { diameterThresholdMm: -1, firstGroup: 'baseball' } }))
    expect(readBatGrouping(storage).settings).toEqual({ diameterThresholdMm: 60, firstGroup: 'baseball' })
    values.set(batGroupingStorage.key, JSON.stringify({ version: 999, settings: { diameterThresholdMm: 70, firstGroup: 'baseball' } }))
    expect(readBatGrouping(storage).settings).toEqual(defaultBatGrouping)
    values.set(batGroupingStorage.key, '{')
    expect(readBatGrouping(storage)).toEqual({ settings: defaultBatGrouping, unavailable: true })
    const blocked = { getItem: () => { throw Error() }, setItem: () => { throw Error() } }
    expect(readBatGrouping(blocked)).toEqual({ settings: defaultBatGrouping, unavailable: true })
    expect(saveBatGrouping(blocked, defaultBatGrouping)).toBe(false)
  })
})
