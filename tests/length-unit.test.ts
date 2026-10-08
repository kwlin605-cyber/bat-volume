import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import ExcelJS from 'exceljs'
import { fromMillimetres, type LengthDisplayMode } from '../src/domain/length-unit'
import { halfInchValue, lengthDisplay } from '../src/lib/length-display'
import { readLengthUnit, saveLengthUnit, lengthUnitStorageKey } from '../src/services/length-unit-storage'
import { saveWeightUnit, readWeightUnit } from '../src/services/weight-unit-storage'
import { analyzeAnc } from '../src/domain/analyze'
import { buildBatchView } from '../src/features/batch/view-model'
import { createExcelReport } from '../src/reports/excel-report'
import { reportStyle } from '../src/config/report'
import { buildReportLayout } from '../src/reports/report-layout'
import type { AnalysisEntry } from '../src/services/analysis-state'

const raw = readFileSync(new URL('./fixtures/case-001.anc', import.meta.url), 'utf8')
const result = analyzeAnc(raw, { name: 'sample.anc', size: raw.length })
if (result.status !== 'calculated') throw new Error('Expected calculated fixture')
const base = result
const entry = (name: string, inches: number): AnalysisEntry => {
  const source = { name, size: raw.length }
  return { id: name, source, state: { status: 'result', result: { ...base, source, dimensions: { ...base.dimensions, lengthMm: inches * 25.4 } } } }
}
const entries = [entry('bat10.anc', 33.1), entry('bat2.anc', 33.1), entry('short.anc', 32.9), entry('long.anc', 33.5)]
const view = (mode: LengthDisplayMode) => buildBatchView(entries, ['length', 'maximumDiameter', 'gripDiameter'], { key: 'length', direction: 'asc' }, undefined, mode)

describe('length display units', () => {
  it.each([[28.2, '28'], [28.3, '28.5'], [32.7, '32.5'], [32.8, '33'], [28.25, '28.5'], [28.75, '29']])('rounds %s inches to %s only at presentation', (inches, expected) => {
    const mm = Number(inches) * 25.4
    expect(fromMillimetres(mm, 'in')).toBeCloseTo(Number(inches), 12)
    expect(lengthDisplay(mm, 'in')).toEqual({ display: expected })
  })
  it('uses millimetres for sorting, breaks exact ties by natural filename and leaves all geometry intact', () => {
    const original = structuredClone(entries)
    for (const mode of ['mm', 'in', 'both'] as const) {
      const current = view(mode)
      expect(current.rows.map(row => row.name)).toEqual(['short.anc', 'bat2.anc', 'bat10.anc', 'long.anc'])
      expect(current.rows[0].cells.length.value).toBe(32.9 * 25.4)
      expect(current.rows[0].cells.volume).toEqual(view('mm').rows[0].cells.volume)
      expect(current.rows[0].cells.maximumDiameter).toEqual(view('mm').rows[0].cells.maximumDiameter)
      expect(current.columns.find(column => column.id === 'maximumDiameter')!.unit).toBe('mm')
    }
    expect(view('in').rows.slice(0, 3).map(row => row.cells.length.display)).toEqual(['33', '33', '33'])
    expect(entries).toEqual(original)
  })
  it('shows both units in two lines and leaves missing lengths unavailable', () => {
    expect(lengthDisplay(838.2, 'both')).toEqual({ display: '838.2 mm', secondary: '33 in' })
    const failed: AnalysisEntry = { id: 'loading', source: { name: 'loading', size: 0 }, state: { status: 'loading', source: { name: 'loading', size: 0 } } }
    expect(buildBatchView([failed], ['length'], { key: 'length', direction: 'desc' }, undefined, 'both').rows[0].cells.length).toEqual({ value: null, display: '—' })
  })
  it('saves length independently of weight and falls back to mm for missing, invalid or blocked storage', () => {
    const saved = new Map<string, string>()
    const storage = { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => { saved.set(key, value) } }
    expect(readLengthUnit(storage).mode).toBe('mm')
    saveWeightUnit(storage, 'oz'); saveLengthUnit(storage, 'both')
    expect(readWeightUnit(storage).mode).toBe('oz')
    expect(readLengthUnit(storage).mode).toBe('both')
    saved.set(lengthUnitStorageKey, 'invalid')
    expect(readLengthUnit(storage).mode).toBe('mm')
    const blocked = { getItem: () => { throw Error() }, setItem: () => { throw Error() } }
    expect(readLengthUnit(blocked)).toEqual({ mode: 'mm', unavailable: true })
    expect(saveLengthUnit(blocked, 'in')).toBe(false)
  })
})

describe('length units in exported reports', () => {
  it.each(['mm', 'in', 'both'] as const)('writes matching %s values and formats to an actual Excel file', async mode => {
    const current = view(mode)
    const buffer = await createExcelReport(current).xlsx.writeBuffer()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const sheet = workbook.worksheets[0]
    expect(sheet.getCell('B1').text).toBe(`長度 ${mode === 'both' ? 'mm / in' : mode}`)
    current.rows.forEach((row, index) => {
      const cell = sheet.getCell(index + 2, 2)
      if (mode === 'both') {
        expect(cell.text).toBe(`${row.cells.length.display}\n${row.cells.length.secondary}`)
        expect(sheet.getRow(index + 2).height).toBeGreaterThanOrEqual(54)
      } else {
        expect(cell.value).toBe(mode === 'in' ? halfInchValue(row.cells.length.value!) : row.cells.length.value)
        expect(cell.numFmt).toBe(mode === 'in' && Number.isInteger(Number(cell.value)) ? '#,##0' : '#,##0.0')
      }
    })
    expect(sheet.pageSetup).toMatchObject({ orientation: 'portrait', fitToWidth: 1, fitToHeight: 0 })
  })
  it('measures both length lines for PDF layout and includes the half-inch secondary line', () => {
    const current = view('both')
    const layout = buildReportLayout(current, (value, size) => value.length * size)
    const length = layout.columns.find(item => item.column.id === 'length')!
    expect(length.width).toBeGreaterThan(current.rows[0].cells.length.display.length * reportStyle.fonts.value.size)
    expect(layout.rows.every(row => row.row.cells.length.secondary?.endsWith(' in'))).toBe(true)
    expect(layout.rows.every(row => row.height >= reportStyle.minimumRowHeight)).toBe(true)
  })
})
