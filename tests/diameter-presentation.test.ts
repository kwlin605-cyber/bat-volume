import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { analyzeAnc } from '../src/domain/analyze'
import type { AnalysisEntry } from '../src/services/analysis-state'
import { buildBatchView } from '../src/features/batch/view-model'
import { createExcelReport } from '../src/reports/excel-report'
import { buildReportLayout } from '../src/reports/report-layout'
import { paintReportPage } from '../src/reports/report-canvas'
import { DimensionsSummary } from '../src/components/dimensions-summary'
import { PreviewMeasurements } from '../src/components/preview-measurements'
import { MobileResultView } from '../src/components/mobile-result-view'

const raw = readFileSync(new URL('./fixtures/case-001.anc', import.meta.url), 'utf8')
const base = analyzeAnc(raw, { name: 'sample.anc', size: raw.length })
if (base.status !== 'calculated' || base.dimensions.grip.status !== 'detected') throw new Error('Expected measured fixture')
const measured = { ...base, dimensions: { ...base.dimensions, maximumDiameterMm: 60.36, grip: { ...base.dimensions.grip, diameterMm: 24.87 } } }
const entry: AnalysisEntry = { id: 'sample', source: measured.source, state: { status: 'result', result: measured } }
const columns = ['maximumDiameter', 'gripDiameter', 'length', 'volume', 'batWeight', 'materialWeight'] as const
const weights = { material: { referenceDensity: 0.7, volumeCm3: 3000, weightG: null, weightErrorPercent: 0 }, requirements: {} }
const view = () => buildBatchView([entry], columns, { key: 'name', direction: 'asc' }, weights, 'cm')

describe('raw diameter presentation', () => {
  it('keeps full analyzed diameters and source geometry while rounding only the display', () => {
    const original = structuredClone(entry)
    const cells = view().rows[0].cells
    expect(cells.maximumDiameter).toEqual({ value: 60.36, display: '60.4' })
    expect(cells.gripDiameter).toEqual({ value: 24.87, display: '24.9' })
    expect(cells.length.value).toBe(measured.dimensions.lengthMm)
    expect(cells.volume.value).toBe(measured.volumeCm3)
    expect(entry).toEqual(original)
  })
  it('uses full raw diameter precision for grouping and sorting', () => {
    const entries: AnalysisEntry[] = [['a-base', 60.1], ['z-soft', 59.9], ['a-larger', 60.36], ['z-smaller', 60.35]].map(([id, diameter]) => {
      const source = { name: String(id), size: 1 }
      return { id: String(id), source, state: { status: 'result', result: { ...measured, source, dimensions: { ...measured.dimensions, maximumDiameterMm: Number(diameter) } } } }
    })
    const current = buildBatchView(entries, ['maximumDiameter'], { key: 'maximumDiameter', direction: 'asc' }, undefined, 'cm')
    expect(current.rows.map(row => row.id)).toEqual(['z-soft', 'a-base', 'z-smaller', 'a-larger'])
    expect(current.rows[1].cells.maximumDiameter.display).toBe('60.1')
    expect(current.rows.slice(2).map(row => row.cells.maximumDiameter.display)).toEqual(['60.4', '60.4'])
    const byName = buildBatchView(entries.slice(0, 2), [], { key: 'name', direction: 'asc' })
    expect(byName.rows.map(row => row.id)).toEqual(['z-soft', 'a-base'])
  })
  it('keeps an undetermined grip unavailable', () => {
    const missing: AnalysisEntry = { ...entry, state: { status: 'result', result: { ...measured, dimensions: { ...measured.dimensions, grip: { status: 'undetermined', code: 'missingGripKnob' } } } } }
    expect(buildBatchView([missing], columns, { key: 'name', direction: 'asc' }).rows[0].cells.gripDiameter).toEqual({ value: null, display: '—' })
  })
  it('shares one-decimal values with single-bat/mobile cards and PDF painting', () => {
    const current = view()
    const markup = [
      renderToStaticMarkup(createElement(DimensionsSummary, { dimensions: measured.dimensions })),
      renderToStaticMarkup(createElement(PreviewMeasurements, { dimensions: measured.dimensions })),
      renderToStaticMarkup(createElement(MobileResultView, { entry, material: weights.material, weightUnit: 'oz', lengthUnit: 'in', onMaterialOpen() {}, onOpenLibrary() {} })),
    ]
    const written: string[] = []
    const ctx = { measureText: (value: string) => ({ width: value.length * 8 }), fillText: (value: string) => written.push(value), fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} } as unknown as CanvasRenderingContext2D
    paintReportPage(ctx, buildReportLayout(current, value => value.length * 8), new AbortController().signal)
    for (const id of ['maximumDiameter', 'gripDiameter'] as const) {
      const display = current.rows[0].cells[id].display
      for (const rendered of markup) expect(rendered).toContain(`<span>${display}</span>`)
      expect(written).toContain(display)
    }
  })
  it('round-trips full raw Excel numbers with a one-decimal display format', async () => {
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
