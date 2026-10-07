import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { analyzeAnc } from '../src/domain/analyze'
import type { AnalysisResult } from '../src/domain/types'
import type { AnalysisEntry } from '../src/services/analysis-state'
import { analyzeBatch } from '../src/services/analyze-batch'
import { allMetricIds, defaultMetricIds } from '../src/features/batch/columns'
import { buildBatchView, defaultSort } from '../src/features/batch/view-model'
import { buildReportLayout, reportScale } from '../src/reports/png-layout'
import { reportStyle } from '../src/config/report'
import { text } from '../src/i18n/zh-TW'
import corpus from './fixtures/corpus.json'

const result = analyzeAnc(readFileSync(new URL(`./fixtures/${corpus.find(sample => sample.cuts)!.file}`, import.meta.url), 'utf8'), { name: 'sample.anc', size: 1 })
if (result.status !== 'calculated') throw new Error('Expected calculated fixture')
const base = result
function entry(id: string, name: string, volume: number, grip = true): AnalysisEntry {
  const source = { name, size: 1 }
  return { id, source, state: { status: 'result', result: { ...base, source, volumeCm3: volume,
    dimensions: { ...base.dimensions, grip: grip ? base.dimensions.grip : { status: 'undetermined', code: 'ambiguousGripEnd' } } } } }
}
const failed: AnalysisEntry = { id: 'failed', source: { name: 'failed.anc', size: 1 }, state: { status: 'result', result: { status: 'undetermined', source: { name: 'failed.anc', size: 1 }, code: 'missingHighEnd' } } }
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }

describe('batch data shared by table and report', () => {
  it('corrects estimates or raw requirements while keeping fixed bat targets in grams', () => {
    const view = buildBatchView([entry('fixed', 'fixed.anc', 1000), entry('reference', 'reference.anc', 1000)], defaultMetricIds, defaultSort, {
      material: { referenceDensity: 0.7, volumeCm3: 3000, weightG: null, weightErrorPercent: -3 },
      requirements: { fixed: { min: 800, max: 800 } }, weightUnit: 'both',
    })
    expect(view.rows[0].cells.batWeight).toEqual({ value: 800, maximum: 800, display: '800' })
    expect(view.rows[0].cells.materialWeight.value).toBeCloseTo(2400 / 0.97, 10)
    expect(view.rows[0].cells.materialWeight.display).toBe('2,474 g')
    expect(view.rows[0].cells.materialWeight.secondary).toBeDefined()
    expect(view.rows[1].cells.batWeight.display).toBe('679')
    expect(view.rows[1].cells.materialWeight.value).toBe(2100)
  })
  it('defaults to weight requirements, material weight and volume, with targets isolated by entry ID', () => {
    const view = buildBatchView([entry('a', 'same.anc', 1000), entry('b', 'same.anc', 2000)], defaultMetricIds, defaultSort, {
      material: { referenceDensity: 0.7, volumeCm3: 3000, weightG: null, weightErrorPercent: 0 }, requirements: { a: { min: 600, max: 650 } },
    })
    expect(view.columns.map(column => column.id)).toEqual(['volume', 'materialWeight', 'batWeight'])
    expect(view.rows[0].cells.materialWeight).toEqual({ value: 1800, maximum: 1950, display: '1,800 – 1,950' })
    expect(view.rows[1].cells.batWeight.value).toBe(1400)
    expect(view.rows[1].cells.materialWeight).toEqual({ value: 2100, display: '2,100' })
  })
  it.each(['asc', 'desc'] as const)('sorts target ranges by full-precision lower then upper limit and missing last, %s', direction => {
    const view = buildBatchView([entry('a', 'a.anc', 1000), entry('b', 'b.anc', 1000), entry('c', 'c.anc', 1000), failed], defaultMetricIds, { key: 'batWeight', direction }, {
      material: { referenceDensity: 0.7, volumeCm3: 3000, weightG: null, weightErrorPercent: 0 },
      requirements: { a: { min: 600.01, max: 650 }, b: { min: 600.01, max: 640 }, c: { min: 600.02, max: 620 } },
    })
    expect(view.rows.map(row => row.id)).toEqual(direction === 'asc' ? ['b', 'a', 'c', 'failed'] : ['c', 'a', 'b', 'failed'])
  })
  it('does not invent default density, and restores a missing estimate when the target is cleared', () => {
    const entries = [entry('a', 'a.anc', 1129.9491175359196)]
    const original = buildBatchView(entries, defaultMetricIds, defaultSort)
    expect(original.rows[0].cells.batWeight.value).toBeNull()
    expect(original.rows[0].cells.batWeight.display).toBe('—')
    expect(original.rows[0].cells.materialWeight.value).toBeNull()
    const overridden = buildBatchView(entries, defaultMetricIds, defaultSort, { material: { referenceDensity: 0.7, volumeCm3: null, weightG: null, weightErrorPercent: 0 }, requirements: { a: { min: 600, max: 650 } } })
    expect(overridden.rows[0].cells.batWeight.display).toBe('600 – 650')
    const cleared = buildBatchView(entries, defaultMetricIds, defaultSort)
    expect(cleared.rows[0].cells.batWeight).toEqual(original.rows[0].cells.batWeight)
  })
  it('sorts estimated single weights and requested ranges together by their displayed quantity', () => {
    const view = buildBatchView([entry('estimate', 'estimate.anc', 1000), entry('target', 'target.anc', 2000), failed], defaultMetricIds, { key: 'batWeight', direction: 'desc' }, { material: { referenceDensity: 0.7, volumeCm3: null, weightG: null, weightErrorPercent: 0 }, requirements: { target: { min: 600, max: 650 } } })
    expect(view.rows.map(row => row.id)).toEqual(['estimate', 'target', 'failed'])
  })
  it('sorts natural filenames and keeps duplicate names as separate entries', () => {
    const view = buildBatchView([entry('10', 'bat10.anc', 3), entry('2a', 'bat2.anc', 1), entry('2b', 'bat2.anc', 2)], allMetricIds, defaultSort)
    expect(view.rows.map(row => row.id)).toEqual(['2a', '2b', '10'])
  })
  it('sorts on full precision even when display values round to the same number', () => {
    const view = buildBatchView([entry('a', 'a.anc', 100.4), entry('b', 'b.anc', 100.1)], allMetricIds, { key: 'volume', direction: 'asc' })
    expect(view.rows.map(row => row.id)).toEqual(['b', 'a'])
    expect(view.rows[0].cells.volume.display).toBe(view.rows[1].cells.volume.display)
  })
  it.each(['asc', 'desc'] as const)('keeps unavailable measurements last in %s order', direction => {
    const view = buildBatchView([failed, entry('b', 'b.anc', 20), entry('a', 'a.anc', 10)], allMetricIds, { key: 'volume', direction })
    expect(view.rows.at(-1)?.id).toBe('failed')
    expect(view.rows.at(-1)?.cells.volume).toEqual({ value: null, display: text.missingValue })
  })
  it('preserves valid dimensions and a reason when only the grip is unknown', () => {
    const view = buildBatchView([entry('partial', 'partial.anc', 25, false), failed], ['volume', 'gripDiameter'], defaultSort)
    expect(view.columns.map(column => column.id)).toEqual(['volume', 'gripDiameter'])
    const partial = view.rows.find(row => row.id === 'partial')!
    expect(partial.cells.volume.value).toBe(25)
    expect(partial.cells.gripDiameter.value).toBeNull()
    expect(partial.status.kind).toBe('partial')
    expect(partial.status.detail).not.toBe('')
    expect(view.summary).toEqual({ total: 2, calculated: 1, failed: 1, pending: 0 })
  })
})

describe('full-length PNG report layout', () => {
  it('includes every row with untruncated filenames, reasons and selected columns', () => {
    const longName = '很長的球棒檔名'.repeat(30) + '.anc'
    const entries = Array.from({ length: 43 }, (_, i) => entry(String(i), longName + i, i))
    entries.push(failed)
    const view = buildBatchView(entries, ['length'], { key: 'volume', direction: 'desc' })
    const layout = buildReportLayout(view, value => [...value].length * 15)
    expect(layout.tableY).toBe(reportStyle.padding)
    expect(layout.rows[0].y).toBe(reportStyle.padding + reportStyle.headingHeight)
    expect(layout.rows).toHaveLength(44)
    expect(layout.rows[0].row.id).toBe('42')
    expect(layout.rows[0].nameLines.join('')).toBe(longName + '42')
    expect(layout.rows.at(-1)?.detailLines.join('')).toBe(view.rows.at(-1)?.status.detail)
    expect(layout.height).toBeGreaterThan(layout.rows.at(-1)!.y + layout.rows.at(-1)!.height)
    expect(layout.height).toBeGreaterThan(800)
    expect(layout.width).toBeLessThan(buildReportLayout(buildBatchView(entries, allMetricIds, defaultSort), value => value.length * 15).width)
  })
  it('reduces resolution when necessary and rejects an image that cannot hold all rows', () => {
    expect(reportScale(1400, 12000)).toBeGreaterThanOrEqual(1)
    expect(reportScale(1400, 12000)).toBeLessThan(2)
    expect(() => reportScale(1400, 20000)).toThrow(text.reportTooLarge)
    expect(() => reportScale(16000, 16000)).toThrow(text.reportTooLarge)
  })
})

describe('bounded batch execution', () => {
  const files = Array.from({ length: 5 }, (_, i) => new File(['G1'], `bat${i}.anc`))
  const failResult = (file: File): AnalysisResult => ({ status: 'undetermined', source: { name: file.name, size: file.size }, code: 'noProfile' })
  it('keeps only two files active and isolates a failure without losing later files', async () => {
    const gates = files.map(() => deferred<AnalysisResult>())
    let active = 0, peak = 0
    const started: number[] = [], finished: number[] = []
    const running = analyzeBatch(files, new AbortController().signal, index => finished.push(index), 2, async file => {
      const index = files.indexOf(file); started.push(index); peak = Math.max(peak, ++active)
      try { if (index === 1) throw new Error('worker failed'); return await gates[index].promise }
      finally { active-- }
    })
    await Promise.resolve()
    expect(started).toEqual([0, 1, 2])
    gates[2].resolve(failResult(files[2])); await Promise.resolve(); await Promise.resolve()
    expect(started).toEqual([0, 1, 2, 3])
    for (const [i, gate] of gates.entries()) gate.resolve(failResult(files[i]))
    await running
    expect(peak).toBe(2)
    expect([...finished].sort()).toEqual([0, 1, 2, 3, 4])
  })
  it('does not launch more work or deliver stale results after replacement cancels a batch', async () => {
    const controller = new AbortController(), gate = deferred<AnalysisResult>()
    const started: string[] = [], delivered: number[] = []
    const running = analyzeBatch(files, controller.signal, index => delivered.push(index), 2, file => { started.push(file.name); return gate.promise })
    controller.abort(); gate.resolve(failResult(files[0])); await running
    expect(started).toHaveLength(2)
    expect(delivered).toEqual([])
  })
})
