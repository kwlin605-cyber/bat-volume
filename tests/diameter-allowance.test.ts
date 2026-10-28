import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { defaultDiameterAllowanceMm, finishedDiameter, parseDiameterAllowance } from '../src/domain/diameter-allowance'
import { readDiameterAllowance, saveDiameterAllowance, diameterAllowanceStorageKey } from '../src/services/diameter-allowance-storage'
import { analyzeAnc } from '../src/domain/analyze'
import type { AnalysisEntry } from '../src/services/analysis-state'
import { buildBatchView } from '../src/features/batch/view-model'
import { createExcelReport } from '../src/reports/excel-report'
import { buildReportLayout } from '../src/reports/report-layout'
import { paintReportPage } from '../src/reports/report-canvas'
import { DimensionsSummary } from '../src/components/dimensions-summary'
import { formatDimension } from '../src/lib/format'

const raw = readFileSync(new URL('./fixtures/case-001.anc', import.meta.url), 'utf8')
const base = analyzeAnc(raw, { name: 'sample.anc', size: raw.length })
if (base.status !== 'calculated' || base.dimensions.grip.status !== 'detected') throw new Error('Expected measured fixture')
const measured = { ...base, dimensions: { ...base.dimensions, maximumDiameterMm: 60.36, grip: { ...base.dimensions.grip, diameterMm: 24.87 } } }
const entry: AnalysisEntry = { id: 'sample', source: measured.source, state: { status: 'result', result: measured } }
const columns = ['maximumDiameter', 'gripDiameter', 'length', 'volume', 'batWeight', 'materialWeight'] as const
const weights = { material: { referenceDensity: 0.7, volumeCm3: 3000, weightG: null, weightErrorPercent: 0 }, requirements: {} }
const view = (allowance = defaultDiameterAllowanceMm) => buildBatchView([entry], columns, { key: 'name', direction: 'asc' }, weights, 'cm', undefined, allowance)

describe('finishing diameters', () => {
  it.each([[60.36, '60.2'], [24.87, '24.7'], [60.3499, '60.1'], [60.35, '60.2'], [24.8499, '24.6'], [24.85, '24.7']])('subtracts before rounding %s to %s', (rawMm, display) => {
    const adjusted = finishedDiameter(Number(rawMm), 0.2)!
    expect(adjusted).toBe(Number(rawMm) - 0.2)
    expect(formatDimension(adjusted)).toBe(display)
  })
  it('keeps the source, length, volume and weights unchanged while adjusting both diameters', () => {
    const original = structuredClone(entry)
    const cells = view(0.2).rows[0].cells
    expect(cells.maximumDiameter).toEqual({ value: 60.36 - 0.2, display: '60.2' })
    expect(cells.gripDiameter).toEqual({ value: 24.87 - 0.2, display: '24.7' })
    for (const id of ['length', 'volume', 'batWeight', 'materialWeight'] as const) expect(cells[id]).toEqual(view(0).rows[0].cells[id])
    expect(view(0).rows[0].cells.maximumDiameter.value).toBe(60.36)
    expect(view(0.35).rows[0].cells.gripDiameter.value).toBe(24.87 - 0.35)
    expect(entry).toEqual(original)
  })
  it('uses raw diameter for grouping and full adjusted precision for sorting', () => {
    const entries: AnalysisEntry[] = [['a-base', 60.1], ['z-soft', 59.9], ['a-larger', 60.36], ['z-smaller', 60.35]].map(([id, diameter]) => {
      const source = { name: String(id), size: 1 }
      return { id: String(id), source, state: { status: 'result', result: { ...measured, source, dimensions: { ...measured.dimensions, maximumDiameterMm: Number(diameter) } } } }
    })
    const current = buildBatchView(entries, ['maximumDiameter'], { key: 'maximumDiameter', direction: 'asc' }, undefined, 'cm', undefined, 0.2)
    expect(current.rows.map(row => row.id)).toEqual(['z-soft', 'a-base', 'z-smaller', 'a-larger'])
    expect(current.rows[1].cells.maximumDiameter.display).toBe('59.9')
    expect(current.rows.slice(2).map(row => row.cells.maximumDiameter.display)).toEqual(['60.2', '60.2'])
    const byName = buildBatchView(entries.slice(0, 2), [], { key: 'name', direction: 'asc' })
    expect(byName.rows.map(row => row.id)).toEqual(['z-soft', 'a-base'])
  })
  it('keeps missing and nonpositive adjusted diameters unavailable', () => {
    for (const raw of [null, NaN, Infinity, 0, 0.1, 0.2]) expect(finishedDiameter(raw, 0.2)).toBeNull()
    for (const raw of [null, NaN, Infinity, 0, -1]) expect(finishedDiameter(raw, 0)).toBeNull()
    expect(view(100).rows[0].cells.maximumDiameter).toEqual({ value: null, display: '—' })
    const missing: AnalysisEntry = { ...entry, state: { status: 'result', result: { ...measured, dimensions: { ...measured.dimensions, grip: { status: 'undetermined', code: 'missingGripKnob' } } } } }
    expect(buildBatchView([missing], columns, { key: 'name', direction: 'asc' }).rows[0].cells.gripDiameter).toEqual({ value: null, display: '—' })
  })
  it('shares one-decimal values with single-bat/mobile cards and PDF painting', () => {
    const current = view(0.35)
    const markup = renderToStaticMarkup(createElement(DimensionsSummary, { dimensions: measured.dimensions, diameterAllowanceMm: 0.35 }))
    const written: string[] = []
    const ctx = { measureText: (value: string) => ({ width: value.length * 8 }), fillText: (value: string) => written.push(value), fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} } as unknown as CanvasRenderingContext2D
    paintReportPage(ctx, buildReportLayout(current, value => value.length * 8), new AbortController().signal)
    for (const id of ['maximumDiameter', 'gripDiameter'] as const) {
      const display = current.rows[0].cells[id].display
      expect(markup).toContain(`<span>${display}</span>`)
      expect(written).toContain(display)
    }
  })
  it('round-trips full adjusted Excel numbers with a one-decimal display format', async () => {
    const current = view()
    const buffer = await createExcelReport(current).xlsx.writeBuffer()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    for (const id of ['maximumDiameter', 'gripDiameter'] as const) {
      const position = current.columns.findIndex(column => column.id === id) + 2
      const cell = workbook.worksheets[0].getCell(2, position)
      expect(cell.value).toBe(current.rows[0].cells[id].value)
      expect(cell.numFmt).toBe('#,##0.0')
    }
  })
})

describe('diameter allowance preference', () => {
  it('defaults old/missing or corrupt settings to 0 and preserves zero and custom values', () => {
    const values = new Map<string, string>([['bat-volume.length-unit', 'in']])
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
    expect(readDiameterAllowance(storage)).toEqual({ value: 0, unavailable: false })
    for (const value of [0, 0.35]) {
      expect(saveDiameterAllowance(storage, value)).toBe(true)
      expect(readDiameterAllowance(storage).value).toBe(value)
    }
    for (const invalid of ['-0.2', 'NaN', 'Infinity', 'bad']) {
      values.set(diameterAllowanceStorageKey, invalid)
      expect(readDiameterAllowance(storage).value).toBe(0)
      expect(parseDiameterAllowance(invalid)).toBeNull()
    }
    expect(parseDiameterAllowance('')).toBe(0)
    expect(parseDiameterAllowance('   ')).toBe(0)
    expect(values.get('bat-volume.length-unit')).toBe('in')
    expect(saveDiameterAllowance(storage, -1)).toBe(false)
  })
  it('reports storage failures without losing the default or accepting invalid drafts', () => {
    const storage = { getItem: () => { throw Error() }, setItem: () => { throw Error() } }
    expect(readDiameterAllowance(storage)).toEqual({ value: 0, unavailable: true })
    expect(saveDiameterAllowance(storage, 0.3)).toBe(false)
    expect(parseDiameterAllowance('0')).toBe(0)
    expect(parseDiameterAllowance('0.25')).toBe(0.25)
  })
})
