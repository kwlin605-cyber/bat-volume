import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import ExcelJS from 'exceljs'
import { analyzeAnc } from '../src/domain/analyze'
import { buildBatchView, defaultSort } from '../src/features/batch/view-model'
import { textUnits } from '../src/features/batch/column-layout'
import { createPrintPreview } from '../src/reports/print-preview'
import { buildPdfLayout } from '../src/reports/pdf-layout'
import { createExcelReport, pointsToExcelWidth } from '../src/reports/excel-report'
import { reportStyle, scaledReportStyle, validPrintScale } from '../src/config/report'
import { displayFileName } from '../src/lib/file-name'
import type { AnalysisEntry } from '../src/services/analysis-state'

const raw = readFileSync(new URL('./fixtures/case-001.anc', import.meta.url), 'utf8')
const source = { name: '球棒.v2.ANC', size: raw.length }
const result = analyzeAnc(raw, source)
const entries: AnalysisEntry[] = Array.from({ length: 20 }, (_, index) => ({
  id: String(index), source, state: { status: 'result', result },
}))
const view = buildBatchView(entries, ['length', 'maximumDiameter'], defaultSort)
const measure = (value: string, size: number) => textUnits(value) * size * 0.5

describe('print preview and prepared downloads', () => {
  it.each(['portrait', 'landscape'] as const)('finds the largest fitting integer scale against a fixed 100%% baseline in %s', orientation => {
    const session = createPrintPreview(view, orientation, measure)
    const before = JSON.stringify(view)
    expect(session.baseline.percent).toBe(100)
    expect(session.baselinePages).toBe(session.baseline.pages.length)
    expect(session.maximumLayout).not.toBeNull()
    const fitted = session.maximumLayout!
    const maximum = fitted.percent
    expect(fitted.widthOverflow).toBe(false)
    expect(fitted.pages.length).toBeLessThanOrEqual(session.baselinePages)
    if (maximum < 200) {
      const next = session.layoutAt(maximum + 1)
      expect(next.widthOverflow || next.pages.length > session.baselinePages).toBe(true)
    }
    const large = session.layoutAt(200)
    expect(large.pages.length).toBeGreaterThan(session.baselinePages)
    expect(session.baseline.percent).toBe(100)
    expect(createPrintPreview(view, orientation, measure).baseline.percent).toBe(100)
    expect(JSON.stringify(view)).toBe(before)
    for (const page of fitted.pages) {
      expect(page.tableY).toBeGreaterThanOrEqual(5 * 72 / 25.4)
      expect(page.tableY).toBeCloseTo(fitted.height - page.rows.at(-1)!.y - page.rows.at(-1)!.height)
      expect(page.rows.at(-1)!.y + page.rows.at(-1)!.height).toBeLessThanOrEqual(fitted.height - reportStyle.padding + 0.01)
    }
    expect(fitted.tableOffsetX + fitted.table.width / 2).toBeCloseTo(fitted.width / 2)
  })
  it('scales typography and cells while keeping 5 mm margins and rejecting invalid scales', () => {
    const style = scaledReportStyle(125)
    expect(style.padding).toBe(reportStyle.padding)
    expect(style.fonts.value.size).toBe(15)
    expect(style.fonts.primaryValue.size).toBe(17.5)
    expect(style.minimumRowHeight).toBe(reportStyle.minimumRowHeight * 1.25)
    for (const value of [0, 24, 201, NaN, Infinity, 100.5]) {
      expect(validPrintScale(value)).toBe(false)
      expect(() => scaledReportStyle(value)).toThrow()
    }
  })
  it('offers a fitting scale when 100% is too wide and reports when no scale fits', () => {
    const wide = { ...view, columns: view.columns.map(column => ({ ...column, label: '寬欄位'.repeat(10) })) }
    const session = createPrintPreview(wide, 'portrait', measure)
    expect(session.baseline.widthOverflow).toBe(true)
    expect(session.maximumLayout!.percent).toBeLessThan(100)
    expect(session.maximumLayout!.widthOverflow).toBe(false)
    expect(() => buildPdfLayout(wide, 'portrait', measure)).toThrow()
    const impossible = { ...wide, columns: wide.columns.map(column => ({ ...column, label: column.label.repeat(100) })) }
    expect(createPrintPreview(impossible, 'portrait', measure).maximumLayout).toBeNull()
  })
  it('writes the chosen layout to Excel without a second fit-to-page scale or rounded values', async () => {
    const prepared = buildPdfLayout(view, 'portrait', measure, 125)
    const original = createExcelReport(view, new Date(), undefined, 125, prepared)
    const restored = new ExcelJS.Workbook()
    await restored.xlsx.load(await original.xlsx.writeBuffer())
    const sheet = restored.worksheets[0]
    expect(sheet.pageSetup).toMatchObject({ fitToPage: false, scale: 100, horizontalCentered: true, verticalCentered: true })
    expect(sheet.pageSetup.margins!.left).toBeCloseTo(5 / 25.4)
    expect(sheet.pageSetup.margins!.right).toBeCloseTo(5 / 25.4)
    expect(sheet.getColumn(1).width).toBeCloseTo(pointsToExcelWidth(prepared.table.filenameWidth))
    expect(sheet.getRow(1).height).toBe(prepared.table.style.headingHeight)
    expect(sheet.getRow(2).height).toBe(prepared.table.rows[0].height)
    expect(sheet.getCell('B2').font).toMatchObject({ name: 'Segoe UI', size: 15 })
    expect(sheet.getCell('A2').text).toBe('球棒.v2')
    expect(sheet.getCell('A2').value).toMatchObject({ richText: [
      { text: '球棒', font: { name: 'Microsoft JhengHei' } },
      { text: '.v2', font: { name: 'Segoe UI' } },
    ] })
    expect(sheet.getCell('C2').value).toBe(view.rows[0].cells.maximumDiameter.value)
    expect(sheet.getCell('C2').numFmt).toBe('#,##0.0')
    expect(sheet.headerFooter.oddFooter).toContain('&P')
  })
})

describe('display filenames', () => {
  it.each([
    ['bat.v2.ANC', 'bat.v2'], ['bat.anc.anc', 'bat.anc'],
    ['bat.anc.txt', 'bat.anc.txt'], ['bat', 'bat'], ['.anc', '.anc'],
  ])('displays %s as %s without removing other suffixes', (rawName, expected) => {
    expect(displayFileName(rawName)).toBe(expected)
  })
  it('keeps source identities intact while wrapping the extension-free report name', () => {
    const layout = buildPdfLayout(view, 'portrait', measure)
    expect(layout.table.rows[0].nameLines.join('')).toBe('球棒.v2')
    expect(view.rows[0].name).toBe(source.name)
    expect(entries[0].source.name).toBe(source.name)
  })
})
