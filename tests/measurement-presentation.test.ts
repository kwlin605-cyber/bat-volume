import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { analyzeAnc } from '../src/domain/analyze'
import { createDefaultBatchDisplay } from '../src/domain/batch-display'
import { formatMeasurementDistance, measurementCaption } from '../src/lib/measurement-display'
import { DimensionsSummary } from '../src/components/dimensions-summary'
import { PreviewMeasurements } from '../src/components/preview-measurements'
import { buildBatchView } from '../src/features/batch/view-model'
import BatchResults from '../src/features/batch/batch-results'
import { allMetricIds } from '../src/features/batch/columns'
import { buildColumnLayout, textUnits } from '../src/features/batch/column-layout'
import { batchTableStyle } from '../src/config/batch'
import { buildPdfLayout } from '../src/reports/pdf-layout'
import { paintReportPage } from '../src/reports/report-canvas'
import { createExcelReport } from '../src/reports/excel-report'
import { reportView } from '../src/reports/report-view'
import type { AnalysisEntry } from '../src/services/analysis-state'
import { text } from '../src/i18n/zh-TW'

const raw = readFileSync(new URL('./fixtures/case-001.anc', import.meta.url), 'utf8')
const result = analyzeAnc(raw, { name: 'measurement.anc', size: raw.length })
if (result.status !== 'calculated' || !result.dimensions.distances) throw new Error('Expected directional measurements')
const entry: AnalysisEntry = { id: 'measurement', source: result.source, state: { status: 'result', result } }
const material = { referenceDensity: 0.7, volumeCm3: 3000, weightG: null, weightErrorPercent: 0 }
const view = (show = false, allowance = 0) => buildBatchView([entry], allMetricIds, { key: 'maximumDiameter', direction: 'asc' }, { material, requirements: {} }, 'cm', undefined, allowance, show)
const measure = (value: string, size: number) => textUnits(value) * size / 2

describe('centimetre measurement display', () => {
  it.each([[102.34, '10.23'], [102.35, '10.24'], [102.36, '10.24'], [0, '0.00'], [123.456789, '12.35']])('rounds only the displayed value for %s mm', (mm, expected) => {
    const ranges = [{ startMm: mm, endMm: mm }]
    expect(formatMeasurementDistance(ranges)).toBe(expected)
    expect(ranges).toEqual([{ startMm: mm, endMm: mm }])
  })
  it('preserves real intervals and separate locations without inventing a continuous span', () => {
    const ranges = [{ startMm: 102.345, endMm: 148.267 }, { startMm: 201.234, endMm: 201.234 }]
    expect(formatMeasurementDistance(ranges)).toBe('10.23～14.83、20.12')
    expect(measurementCaption(ranges, 'head')).toBe('距棒頭 10.23～14.83、20.12 cm')
    expect(formatMeasurementDistance([{ startMm: 100.001, endMm: 100.002 }])).toBe('10.00')
    expect(formatMeasurementDistance(null)).toBe('—')
    expect(measurementCaption(undefined, 'grip')).toBe('距棒尾 —')
  })
})

describe('one optional measurement line in each existing diameter column', () => {
  it('defaults off, keeps the column catalog and raw values, and does not change ordering or geometry', () => {
    const original = JSON.stringify(result)
    const off = view(), on = view(true)
    expect(createDefaultBatchDisplay().showMeasurementDistances).toBe(false)
    expect(off.rows[0].cells.maximumDiameter.measurement).toBeUndefined()
    expect(on.columns).toEqual(off.columns)
    expect(on.rows.map(row => row.id)).toEqual(off.rows.map(row => row.id))
    for (const key of ['maximumDiameter', 'gripDiameter'] as const) {
      expect(on.rows[0].cells[key].value).toBe(off.rows[0].cells[key].value)
      expect(on.rows[0].cells[key].display).toBe(off.rows[0].cells[key].display)
    }
    expect(on.rows[0].cells.maximumDiameter.measurement).toBe(measurementCaption(result.dimensions.distances!.head, 'head'))
    expect(view(true, 0.35).rows[0].cells.maximumDiameter.measurement).toBe(on.rows[0].cells.maximumDiameter.measurement)
    expect(JSON.stringify(result)).toBe(original)
    const sizing = buildColumnLayout(on, batchTableStyle, (value, font) => measure(value, font.size))
    const maximum = sizing.columns.find(column => column.column.id === 'maximumDiameter')!
    expect(maximum.width).toBeGreaterThanOrEqual(measure(on.rows[0].cells.maximumDiameter.measurement!, batchTableStyle.fonts.detail.size) + 2 * batchTableStyle.cellPadding)
  })
  it('does not fabricate distances for unavailable, loading or undetermined geometry', () => {
    const entries: AnalysisEntry[] = [
      { ...entry, id: 'loading', state: { status: 'loading', source: entry.source } },
      { ...entry, id: 'missing', state: { status: 'unavailable', source: entry.source, reason: 'presetRemoved' } },
      { ...entry, id: 'failed', state: { status: 'result', result: { status: 'undetermined', source: entry.source, code: 'invalidCuts' } } },
    ]
    const output = buildBatchView(entries, allMetricIds, { key: 'name', direction: 'asc' }, undefined, undefined, undefined, 0, true)
    expect(output.rows.every(row => row.cells.maximumDiameter.measurement === undefined && row.cells.gripDiameter.measurement === undefined)).toBe(true)
    const noDirection: AnalysisEntry = { ...entry, state: { status: 'result', result: { ...result, dimensions: { ...result.dimensions, distances: null, grip: { status: 'undetermined', code: 'ambiguousGripEnd' } } } } }
    const partial = buildBatchView([noDirection], allMetricIds, { key: 'name', direction: 'asc' }, undefined, undefined, undefined, 0, true).rows[0]
    expect(partial.cells.maximumDiameter.value).toBe(result.dimensions.maximumDiameterMm)
    expect(partial.cells.maximumDiameter.measurement).toBe('距棒頭 —')
  })
  it('uses renamed labels everywhere and one checkbox in the existing information menu', () => {
    const markup = renderToStaticMarkup(createElement(BatchResults, {
      diameterAllowanceMm: 0, material, weightUnit: 'g', lengthUnit: 'cm', entries: [entry], requirements: {},
      display: { ...createDefaultBatchDisplay(), showMeasurementDistances: true }, sort: { key: 'name', direction: 'asc' }, removing: false,
      onDiameterAllowanceChange() {}, onWeightUnitChange() {}, onLengthUnitChange() {}, onMaterialOpen() {},
      onDisplayChange() {}, onSortChange() {}, onRemove() {}, onRequirementChange() {},
    }))
    expect(markup).toContain(text.visibleInformation)
    expect(markup.match(/class="measurement-display-toggle"/g)).toHaveLength(1)
    expect(markup).toContain('棒頭直徑')
    expect(markup).toContain('握把直徑')
    expect(markup).not.toMatch(/最大直徑|最細握把|最小握把/)
    expect(markup).toContain(measurementCaption(result.dimensions.distances!.head, 'head'))
    const desktop = renderToStaticMarkup(createElement(DimensionsSummary, { dimensions: result.dimensions }))
    const mobile = renderToStaticMarkup(createElement(PreviewMeasurements, { dimensions: result.dimensions }))
    expect(desktop).toContain(measurementCaption(result.dimensions.distances!.grip, 'grip'))
    expect(mobile).toContain(formatMeasurementDistance(result.dimensions.distances!.head))
    expect(mobile.match(/class="preview-measurement-row"/g)).toHaveLength(2)
    expect(mobile).not.toContain('checkbox')
    expect(mobile).not.toContain('裁切後端面')
  })
})

describe('PDF keeps measurement captions while Excel keeps numeric diameters', () => {
  it.each(['pdf-portrait', 'pdf-landscape'] as const)('paints the selected captions in %s within the same diameter columns', format => {
    const original = view(true), snapshot = JSON.stringify(original)
    const pdf = reportView(original, format)
    expect(pdf.columns).toEqual(original.columns)
    const caption = original.rows[0].cells.maximumDiameter.measurement!
    expect(pdf.rows[0].cells.maximumDiameter.caption).toBe(caption)
    const layout = buildPdfLayout(pdf, format === 'pdf-portrait' ? 'portrait' : 'landscape', measure, 70)
    const written: string[] = []
    const ctx = { measureText: (value: string) => ({ width: measure(value, 12) }), fillText: (value: string) => written.push(value), fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} } as unknown as CanvasRenderingContext2D
    paintReportPage(ctx, layout.pages[0], new AbortController().signal)
    expect(written).toContain(caption)
    expect(JSON.stringify(original)).toBe(snapshot)
  })
  it('removes all measurement text and its layout space from Excel, preserving full numeric precision', async () => {
    const original = view(true), excel = reportView(original, 'xlsx')
    const baseline = view(false)
    expect(excel.rows[0].cells).toEqual(baseline.rows[0].cells)
    const excelLayout = buildPdfLayout(excel, 'portrait', measure, 70)
    const baselineLayout = buildPdfLayout(baseline, 'portrait', measure, 70)
    expect(excelLayout.table.width).toBe(baselineLayout.table.width)
    expect(excelLayout.table.rows[0].height).toBe(baselineLayout.table.rows[0].height)
    const workbook = createExcelReport(original, new Date(0), (value, font) => measure(value, font.size), 70)
    for (const id of ['maximumDiameter', 'gripDiameter'] as const) {
      const column = original.columns.findIndex(column => column.id === id) + 2
      expect(workbook.worksheets[0].getCell(2, column).value).toBe(original.rows[0].cells[id].value)
    }
    const buffer = await workbook.xlsx.writeBuffer()
    expect(buffer.byteLength).toBeGreaterThan(0)
  })
})
