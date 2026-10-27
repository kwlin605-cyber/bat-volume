import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import ExcelJS from 'exceljs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DimensionsSummary } from '../src/components/dimensions-summary'
import { fromMillimetres, type LengthDisplayMode } from '../src/domain/length-unit'
import { quarterInchValue, lengthDisplay } from '../src/lib/length-display'
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
const entries = [entry('bat10.anc', 33.1), entry('bat2.anc', 33.1), entry('short.anc', 32.9), entry('long.anc', 33.5), entry('quarter.anc', 33.25), entry('three-quarter.anc', 33.75)]
const view = (mode: LengthDisplayMode) => buildBatchView(entries, ['length', 'maximumDiameter', 'gripDiameter'], { key: 'length', direction: 'asc' }, undefined, mode)

describe('length display units', () => {
  it.each([[870.24, '87.0'], [870.449, '87.0'], [870.4999, '87.0'], [870.5, '87.1'], [870.549, '87.1'], [875, '87.5']])('converts raw %s mm to %s cm without first rounding millimetres', (mm, display) => {
    expect(fromMillimetres(mm, 'cm')).toBe(mm / 10)
    expect(lengthDisplay(mm, 'cm')).toEqual({ display })
    expect(lengthDisplay(mm, 'both').display).toBe(display)
  })
  it('uses the same cm conversion in cards while keeping diameters in mm', () => {
    const markup = renderToStaticMarkup(createElement(DimensionsSummary, { dimensions: { ...base.dimensions, lengthMm: 870.449 } }))
    expect(markup).toContain('data-testid="retained-length"><span>87.0</span><span class="dimension-unit">cm</span>')
    expect(markup.match(/class="dimension-unit">mm/g)).toHaveLength(2)
  })
  it('sorts distinct raw lengths even when their cm displays are identical', () => {
    const samples = [entry('a-long.anc', 870.449 / 25.4), entry('z-short.anc', 870.24 / 25.4)]
    const current = buildBatchView(samples, ['length'], { key: 'length', direction: 'asc' })
    expect(current.columns[0].unit).toBe('cm')
    expect(current.rows.map(row => row.cells.length.display)).toEqual(['87.0', '87.0'])
    expect(current.rows.map(row => row.name)).toEqual(['z-short.anc', 'a-long.anc'])
  })
  it.each([[28.2, '28.25'], [28.3, '28.25'], [32.7, '32.75'], [32.8, '32.75'], [28.25, '28.25'], [28.75, '28.75'], [28.1249, '28'], [28.125, '28.25'], [28.3749, '28.25'], [28.375, '28.5'], [28.625, '28.75'], [28.875, '29']])('rounds %s inches to %s only at presentation', (inches, expected) => {
    const mm = Number(inches) * 25.4
    expect(fromMillimetres(mm, 'in')).toBeCloseTo(Number(inches), 12)
    expect(lengthDisplay(mm, 'in')).toEqual({ display: expected })
  })
  it('uses millimetres for sorting, breaks exact ties by natural filename and leaves all geometry intact', () => {
    const original = structuredClone(entries)
    for (const mode of ['cm', 'in', 'both'] as const) {
      const current = view(mode)
      expect(current.rows.map(row => row.name)).toEqual(['short.anc', 'bat2.anc', 'bat10.anc', 'quarter.anc', 'long.anc', 'three-quarter.anc'])
      expect(current.rows[0].cells.length.value).toBe(32.9 * 25.4)
      expect(current.rows[0].cells.volume).toEqual(view('cm').rows[0].cells.volume)
      expect(current.rows[0].cells.maximumDiameter).toEqual(view('cm').rows[0].cells.maximumDiameter)
      expect(current.columns.find(column => column.id === 'maximumDiameter')!.unit).toBe('mm')
    }
    expect(view('in').rows.slice(0, 3).map(row => row.cells.length.display)).toEqual(['33', '33', '33'])
    expect(entries).toEqual(original)
  })
  it('shows both units in two lines and leaves missing lengths unavailable', () => {
    expect(lengthDisplay(838.2, 'both')).toEqual({ display: '83.8', secondary: '33 in' })
    expect(lengthDisplay(833.12, 'both')).toEqual({ display: '83.3', secondary: '32.75 in' })
    const failed: AnalysisEntry = { id: 'loading', source: { name: 'loading', size: 0 }, state: { status: 'loading', source: { name: 'loading', size: 0 } } }
    expect(buildBatchView([failed], ['length'], { key: 'length', direction: 'desc' }, undefined, 'both').rows[0].cells.length).toEqual({ value: null, display: '—' })
  })
  it('saves length independently of weight and falls back to cm for missing, invalid or blocked storage', () => {
    const saved = new Map<string, string>()
    const storage = { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => { saved.set(key, value) } }
    expect(readLengthUnit(storage).mode).toBe('cm')
    saved.set(lengthUnitStorageKey, 'mm')
    expect(readLengthUnit(storage).mode).toBe('cm')
    for (const mode of ['cm', 'in', 'both'] as const) {
      expect(saveLengthUnit(storage, mode)).toBe(true)
      expect(readLengthUnit(storage).mode).toBe(mode)
    }
    saveWeightUnit(storage, 'oz'); saveLengthUnit(storage, 'both')
    expect(readWeightUnit(storage).mode).toBe('oz')
    expect(readLengthUnit(storage).mode).toBe('both')
    saved.set(lengthUnitStorageKey, 'invalid')
    expect(readLengthUnit(storage).mode).toBe('cm')
    const blocked = { getItem: () => { throw Error() }, setItem: () => { throw Error() } }
    expect(readLengthUnit(blocked)).toEqual({ mode: 'cm', unavailable: true })
    expect(saveLengthUnit(blocked, 'in')).toBe(false)
  })
})

describe('length units in exported reports', () => {
  it('stores full-precision centimetres in Excel while PDF uses the rounded display', async () => {
    const sample: AnalysisEntry = { id: 'raw', source: base.source, state: { status: 'result', result: { ...base, dimensions: { ...base.dimensions, lengthMm: 870.449 } } } }
    const current = buildBatchView([sample], ['length', 'maximumDiameter'], { key: 'name', direction: 'asc' })
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(await createExcelReport(current).xlsx.writeBuffer())
    const sheet = workbook.worksheets[0]
    expect(sheet.getCell('B1').text).toBe('長度 cm')
    expect(sheet.getCell('B2').value).toBe(870.449 / 10)
    expect(sheet.getCell('B2').numFmt).toBe('#,##0.0')
    expect(sheet.getCell('C2').value).toBe(current.rows[0].cells.maximumDiameter.value)
    const pdf = buildReportLayout(current, (value, size) => value.length * size)
    expect(pdf.columns[0].column.unit).toBe('cm')
    expect(pdf.rows[0].row.cells.length.display).toBe('87.0')
    expect(current.rows[0].cells.length.value).toBe(870.449)
  })
  it.each(['cm', 'in', 'both'] as const)('writes matching %s values and formats to an actual Excel file', async mode => {
    const current = view(mode)
    const buffer = await createExcelReport(current).xlsx.writeBuffer()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const sheet = workbook.worksheets[0]
    expect(sheet.getCell('B1').text).toBe(`長度 ${mode === 'both' ? 'cm / in' : mode}`)
    current.rows.forEach((row, index) => {
      const cell = sheet.getCell(index + 2, 2)
      if (mode === 'both') {
        expect(cell.text).toBe(`${row.cells.length.display}\n${row.cells.length.secondary}`)
        expect(sheet.getRow(index + 2).height).toBeGreaterThanOrEqual(reportStyle.minimumRowHeight)
      } else {
        expect(cell.value).toBe(mode === 'in' ? quarterInchValue(row.cells.length.value!) : row.cells.length.value! / 10)
        const expectedFormat = mode !== 'in' ? '#,##0.0' : Number.isInteger(Number(cell.value)) ? '#,##0' : Number.isInteger(Number(cell.value) * 2) ? '#,##0.0' : '#,##0.00'
        expect(cell.numFmt).toBe(expectedFormat)
      }
    })
    expect(sheet.pageSetup).toMatchObject({ orientation: 'portrait', fitToPage: false, scale: 100 })
  })
  it('measures both length lines for PDF layout and includes quarter-inch secondary lines', () => {
    const current = view('both')
    const layout = buildReportLayout(current, (value, size) => value.length * size)
    const length = layout.columns.find(item => item.column.id === 'length')!
    expect(length.width).toBeGreaterThan(current.rows[0].cells.length.display.length * reportStyle.fonts.value.size)
    expect(layout.rows.every(row => row.row.cells.length.secondary?.endsWith(' in'))).toBe(true)
    expect(layout.rows.find(row => row.row.name === 'quarter.anc')!.row.cells.length.secondary).toBe('33.25 in')
    expect(layout.rows.find(row => row.row.name === 'three-quarter.anc')!.row.cells.length.secondary).toBe('33.75 in')
    expect(layout.rows.every(row => row.height >= reportStyle.minimumRowHeight)).toBe(true)
  })
})
