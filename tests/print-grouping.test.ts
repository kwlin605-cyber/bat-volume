import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import { analyzeAnc } from '../src/domain/analyze'
import { buildBatchView } from '../src/features/batch/view-model'
import { textUnits } from '../src/features/batch/column-layout'
import { createPrintPreview } from '../src/reports/print-preview'
import { defaultPrintOptions } from '../src/reports/print-options'
import { createExcelReport, pointsToExcelWidth } from '../src/reports/excel-report'
import { buildPdfLayout } from '../src/reports/pdf-layout'
import { renderReportPage } from '../src/reports/report-rendering'
import type { AnalysisEntry } from '../src/services/analysis-state'
import type { BatGroupingSettings } from '../src/domain/bat-grouping'

const raw = readFileSync(new URL('./fixtures/case-001.anc', import.meta.url), 'utf8')
const source = { name: 'sample.anc', size: raw.length }
const result = analyzeAnc(raw, source)
if (result.status !== 'calculated') throw new Error('Expected calculated fixture')
const base = result
const measure = (value: string, size: number) => textUnits(value) * size * 0.5
function makeView(softball = 20, baseball = 3, grouping: BatGroupingSettings = { diameterThresholdMm: 60, firstGroup: 'softball' }) {
  const entries: AnalysisEntry[] = Array.from({ length: softball + baseball }, (_, index) => ({
    id: String(index), source: { ...source, name: `bat-${index}.anc` },
    state: { status: 'result', result: { ...base, dimensions: { ...base.dimensions, maximumDiameterMm: index < softball ? 59.999 : 60 } } },
  }))
  return buildBatchView(entries, ['length', 'maximumDiameter'], { key: 'name', direction: 'asc' }, undefined, 'cm', grouping, 1)
}

describe('report grouping and one page sizing', () => {
  it('starts each dialog with group breaks on, one-page mode off and a 100% baseline', () => {
    expect(defaultPrintOptions).toEqual({ separateGroups: true, fitOnePage: false })
    const view = makeView()
    const split = createPrintPreview(view, 'portrait', measure)
    expect(split.baseline.percent).toBe(100)
    expect(split.baselinePages).toBe(3)
    expect(split.baseline.sectionStarts).toEqual([0, 20])
    expect(split.baseline.pages.map(page => [...new Set(page.rows.map(item => item.row.group))])).toEqual([['softball'], ['softball'], ['baseball']])
    const continuous = createPrintPreview(view, 'portrait', measure, false)
    expect(continuous.baselinePages).toBe(2)
    expect(continuous.baseline.sectionStarts).toEqual([0])
    expect(continuous.baseline.pages[1].rows.some(item => item.row.group === 'softball')).toBe(true)
    expect(continuous.baseline.pages[1].rows.some(item => item.row.group === 'baseball')).toBe(true)
    continuous.layoutAt(50)
    expect(split.baselinePages).toBe(3)
    expect(continuous.baselinePages).toBe(2)
  })
  it.each([true, false])('uses each section\'s largest scale for one page (split=%s)', separate => {
    const view = makeView()
    const original = JSON.stringify(view)
    const session = createPrintPreview(view, 'portrait', measure, separate)
    expect(session.onePageLayout).not.toBeNull()
    const fitted = session.onePageLayout!
    expect(fitted.widthOverflow).toBe(false)
    expect(fitted.pages).toHaveLength(separate ? 2 : 1)
    expect(fitted.pages.flatMap(page => page.rows.map(item => item.row.id))).toEqual(view.rows.map(row => row.id))
    for (const page of fitted.pages) {
      expect(page.tableY).toBeCloseTo(fitted.height - page.rows.at(-1)!.y - page.rows.at(-1)!.height)
      if (page.percent < 200) {
        const next = buildPdfLayout({ ...view, rows: page.rows.map(item => item.row) }, 'portrait', measure, page.percent + 1, true)
        expect(next.widthOverflow || next.pages.length > 1).toBe(true)
      }
    }
    if (separate) expect(fitted.pages[1].percent).toBeGreaterThan(fitted.pages[0].percent)
    expect(JSON.stringify(view)).toBe(original)
  })
  it('uses the saved boundary, exact raw diameter and existing group order', () => {
    const reversed = makeView(1, 1, { diameterThresholdMm: 60, firstGroup: 'baseball' })
    expect(reversed.rows.map(row => row.group)).toEqual(['baseball', 'softball'])
    // Both displayed finished diameters are below 60; they must still separate at raw 60.
    expect(reversed.rows.every(row => row.cells.maximumDiameter.value! < 60)).toBe(true)
    expect(createPrintPreview(reversed, 'portrait', measure).baselinePages).toBe(2)
    const changed = makeView(1, 1, { diameterThresholdMm: 60.1, firstGroup: 'baseball' })
    expect(createPrintPreview(changed, 'portrait', measure).baselinePages).toBe(1)
    expect(changed.rows.every(row => row.group === 'softball')).toBe(true)
  })
  it.each([[0, 0], [1, 0], [0, 1]])('does not add blank pages for %s softball and %s baseball rows', (softball, baseball) => {
    const session = createPrintPreview(makeView(softball, baseball), 'portrait', measure)
    expect(session.baselinePages).toBe(1)
    expect(session.onePageCount).toBe(1)
    expect(session.onePageLayout!.pages).toHaveLength(1)
    const edited = session.resizePage(session.baseline, 0, 50)
    expect(edited.layout.pages).toHaveLength(1)
    expect(edited.layout.pages[0].percent).toBe(50)
    expect(edited.page).toBe(0)
  })
  it.each(['softball', 'baseball'] as const)('continues unknown rows after the final group with %s first', firstGroup => {
    const view = makeView(1, 1, { diameterThresholdMm: 60, firstGroup })
    view.rows.push({ ...view.rows[0], id: 'unknown', group: 'unclassified', rawMaximumDiameterMm: null })
    const session = createPrintPreview(view, 'portrait', measure)
    expect(session.onePageCount).toBe(2)
    expect(session.baseline.sectionStarts).toEqual([0, 1])
    expect(session.baseline.pages).toHaveLength(2)
    expect(session.layoutAt(25).pages).toHaveLength(2)
    for (const layout of [session.baseline, session.onePageLayout!]) {
      expect(layout.pages[0].rows[0].row.group).toBe(firstGroup)
      expect(layout.pages[1].rows.map(item => item.row.group)).toEqual([firstGroup === 'softball' ? 'baseball' : 'softball', 'unclassified'])
      expect(layout.pages.flatMap(page => page.rows.map(item => item.row.id))).toEqual(view.rows.map(row => row.id))
    }
  })
  it('lets unknown rows paginate naturally and includes them when fitting the last group', () => {
    const view = makeView(1, 2)
    const before = createPrintPreview(view, 'portrait', measure).onePageLayout!
    view.rows.push(...Array.from({ length: 18 }, (_, i) => ({ ...view.rows[0], id: `unknown-${i}`, group: 'unclassified' as const, rawMaximumDiameterMm: null })))
    const session = createPrintPreview(view, 'portrait', measure)
    expect(session.baseline.pages.length).toBeGreaterThan(2)
    expect(session.layoutAt(50).pages).toHaveLength(2)
    expect(session.onePageLayout!.pages).toHaveLength(2)
    expect(session.onePageLayout!.pages[1].rows).toHaveLength(20)
    expect(session.onePageLayout!.pages[1].percent).toBeLessThan(before.pages[1].percent)
    expect(session.onePageLayout!.pages[0].percent).toBe(before.pages[0].percent)
  })
  it('keeps an unknown-only batch in one section, including legacy rows without a group', () => {
    const view = makeView(2, 0)
    view.rows[0].group = 'unclassified'
    view.rows[1].group = undefined
    const session = createPrintPreview(view, 'portrait', measure)
    expect(session.baseline.sectionStarts).toEqual([0])
    expect(session.onePageLayout!.pages).toHaveLength(1)
    expect(session.onePageLayout!.pages[0].rows).toHaveLength(2)
  })
  it('reports an impossible one-page fit instead of discarding rows or pretending it fits', () => {
    const view = makeView(200, 0)
    const session = createPrintPreview(view, 'portrait', measure)
    expect(session.onePageLayout).toBeNull()
    expect(session.baseline.pages.flatMap(page => page.rows)).toHaveLength(200)
  })
  it.each([
    ['portrait', 'softball'], ['portrait', 'baseball'],
    ['landscape', 'softball'], ['landscape', 'baseball'],
  ] as const)('maximizes each group within its own 100%% page allowance in %s, %s first', (orientation, firstGroup) => {
    const view = makeView(20, 3, { diameterThresholdMm: 60, firstGroup })
    view.rows.push({ ...view.rows[0], id: 'unknown', group: 'unclassified', rawMaximumDiameterMm: null })
    const before = JSON.stringify(view)
    const session = createPrintPreview(view, orientation, measure)
    const fitted = session.maximumLayout!
    expect(fitted.sections).toHaveLength(2)
    expect(fitted.sections[0].table.percent).not.toBe(fitted.sections[1].table.percent)
    if (orientation === 'portrait') expect(session.baseline.pages.map(page => page.rows[0].row.group)).toEqual(firstGroup === 'softball' ? ['softball', 'softball', 'baseball'] : ['baseball', 'softball', 'softball'])
    for (const { table } of fitted.sections) {
      const ids = new Set(table.rows.map(item => item.row.id))
      const baselinePages = session.baseline.pages.filter(page => ids.has(page.rows[0].row.id)).length
      const pages = fitted.pages.filter(page => ids.has(page.rows[0].row.id))
      expect(pages.length).toBeLessThanOrEqual(baselinePages)
      expect(pages.every(page => page.percent === table.percent)).toBe(true)
      for (const page of pages) expect(page.tableY).toBeCloseTo(fitted.height - page.rows.at(-1)!.y - page.rows.at(-1)!.height)
      if (table.percent < 200) {
        const next = buildPdfLayout({ ...view, rows: table.rows.map(item => item.row) }, orientation, measure, table.percent + 1, true)
        expect(next.widthOverflow || next.pages.length > baselinePages).toBe(true)
      }
    }
    expect(fitted.pages.at(-1)!.rows.at(-1)!.row.id).toBe('unknown')
    expect(fitted.pages.flatMap(page => page.rows.map(item => item.row.id))).toEqual(view.rows.map(row => row.id))
    session.layoutAt(25)
    session.layoutAt(200)
    expect(JSON.stringify(view)).toBe(before)
    expect(session.baseline.percent).toBe(100)
    expect(session.maximumLayout).toBe(fitted)
    const combined = createPrintPreview(view, orientation, measure, false)
    expect(combined.maximumLayout!.sections).toHaveLength(1)
    expect(combined.maximumLayout!.pages.length).toBeLessThanOrEqual(combined.baselinePages)
  })
  it.each([true, false])('writes actual Excel manual group breaks and the same chosen scale (split=%s)', async separate => {
    const view = makeView()
    const layout = buildPdfLayout(view, 'portrait', measure, 50, false, { separateGroups: separate })
    const buffer = await createExcelReport(view, new Date(), undefined, layout.percent, layout).xlsx.writeBuffer()
    const zip = await JSZip.loadAsync(buffer)
    const xml = await zip.file('xl/worksheets/sheet1.xml')!.async('string')
    const breaks = [...xml.matchAll(/<brk\b[^>]*\bid="(\d+)"/g)].map(match => Number(match[1]))
    expect(breaks).toEqual(separate ? [21] : [])
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const sheet = workbook.worksheets[0]
    expect(sheet.rowCount).toBe(24)
    expect(sheet.getRow(2).height).toBe(layout.table.rows[0].height)
    expect(sheet.getRow(22).height).toBe(layout.table.rows[20].height)
    expect(sheet.pageSetup).toMatchObject({ scale: 100, fitToPage: false, horizontalCentered: true, verticalCentered: true, printTitlesRow: '1:1' })
    expect(sheet.getCell('B22').value).toBe(view.rows[20].cells.length.value! / 10)
  })
  it.each([
    ['softball', 'baseline'], ['baseball', 'baseline'],
    ['softball', 'onePageLayout'], ['baseball', 'onePageLayout'],
    ['softball', 'maximumLayout'], ['baseball', 'maximumLayout'],
  ] as const)('edits only the current group after %s-first %s, retaining the displayed sizes elsewhere', (firstGroup, mode) => {
    const view = makeView(20, 3, { diameterThresholdMm: 60, firstGroup })
    const session = createPrintPreview(view, 'portrait', measure)
    const layout = session[mode]!
    const original = JSON.stringify(layout)
    const edited = session.resizePage(layout, layout.pages.length - 1, 80)
    expect(edited.percentages).toEqual([layout.sections[0].table.percent, 80])
    expect(edited.layout.sections[0]).toEqual(layout.sections[0])
    expect(edited.layout.pages[edited.page].sectionIndex).toBe(1)
    expect(session.groups[1].group).toBe(firstGroup === 'softball' ? 'baseball' : 'softball')
    expect(edited.layout.pages.filter(page => page.sectionIndex === 1).every(page => page.percent === 80)).toBe(true)
    expect(edited.layout.pages.flatMap(page => page.rows.map(item => item.row.id))).toEqual(view.rows.map(row => row.id))
    expect(JSON.stringify(layout)).toBe(original)
    const reduced = session.resizePage(edited.layout, 0, 25)
    expect(reduced.percentages).toEqual([25, 80])
    expect(reduced.layout.pages[reduced.page].sectionIndex).toBe(0)
    expect(session.baseline.sections.every(section => section.table.percent === 100)).toBe(true)
  })
  it('identifies unknown-only continuation pages as the final group and preserves their position after resizing', () => {
    const view = makeView(1, 1)
    view.rows.push(...Array.from({ length: 20 }, (_, i) => ({ ...view.rows[0], id: `unknown-${i}`, group: 'unclassified' as const })))
    const session = createPrintPreview(view, 'portrait', measure)
    const lastPage = session.baseline.pages.at(-1)!
    expect(lastPage.rows.every(item => item.row.group === 'unclassified')).toBe(true)
    expect(session.groups[lastPage.sectionIndex].group).toBe('baseball')
    const edited = session.resizePage(session.baseline, session.baseline.pages.length - 1, 50)
    expect(edited.percentages).toEqual([100, 50])
    expect(edited.layout.pages[edited.page].sectionIndex).toBe(1)
    expect(edited.layout.pages[edited.page].rows.some(item => item.row.id === lastPage.rows[0].row.id)).toBe(true)
    const combined = createPrintPreview(view, 'portrait', measure, false)
    const uniform = combined.resizePage(combined.baseline, combined.baseline.pages.length - 1, 60)
    expect(uniform.layout.sections).toHaveLength(1)
    expect(uniform.layout.pages.every(page => page.percent === 60 && page.sectionIndex === 0)).toBe(true)
    expect(uniform.layout.pages.flatMap(page => page.rows.map(item => item.row.id))).toEqual(view.rows.map(row => row.id))
  })
  it('saves manually edited group sizes and full numeric values to separate Excel sheets', async () => {
    const view = makeView()
    const session = createPrintPreview(view, 'portrait', measure)
    const edited = session.resizePage(session.maximumLayout!, session.maximumLayout!.pages.length - 1, 80)
    const workbook = createExcelReport(view, new Date(), undefined, 100, edited.layout)
    const saved = new ExcelJS.Workbook()
    await saved.xlsx.load(await workbook.xlsx.writeBuffer())
    expect(saved.worksheets.map(sheet => sheet.name)).toEqual(['壘球', '棒球'])
    saved.worksheets.forEach((sheet, index) => {
      const table = edited.layout.sections[index].table
      expect(sheet.getColumn(2).width).toBeCloseTo(pointsToExcelWidth(table.columns[0].width))
      expect(sheet.getRow(1).height).toBe(table.style.headingHeight)
      expect(sheet.pageSetup).toMatchObject({ scale: 100, fitToPage: false, horizontalCentered: true, verticalCentered: true })
      table.rows.forEach((item, rowIndex) => {
        expect(sheet.getRow(rowIndex + 2).height).toBe(item.height)
        expect(sheet.getCell(rowIndex + 2, 2).value).toBe(item.row.cells.length.value! / 10)
      })
    })
  })
  it.each([
    ['softball', 'onePageLayout'], ['baseball', 'onePageLayout'],
    ['softball', 'maximumLayout'], ['baseball', 'maximumLayout'],
  ] as const)('saves independent Excel sizes and unknown rows with %s first in %s', async (firstGroup, mode) => {
    const view = makeView(20, 3, { diameterThresholdMm: 60, firstGroup })
    view.rows.push({ ...view.rows[0], id: 'unknown', name: 'unknown.anc', group: 'unclassified', rawMaximumDiameterMm: null })
    const fitted = createPrintPreview(view, 'portrait', measure)[mode]!
    const buffer = await createExcelReport(view, new Date(), undefined, fitted.percent, fitted).xlsx.writeBuffer()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    expect(workbook.worksheets.map(sheet => sheet.name)).toEqual(firstGroup === 'softball' ? ['壘球', '棒球'] : ['棒球', '壘球'])
    const zip = await JSZip.loadAsync(buffer)
    for (const [index, sheet] of workbook.worksheets.entries()) {
      const { table } = fitted.sections[index]
      expect(sheet.rowCount).toBe(table.rows.length + 1)
      expect(sheet.pageSetup.printArea).toBe(`A1:C${table.rows.length + 1}`)
      expect(sheet.pageSetup).toMatchObject({ fitToPage: false, scale: 100, horizontalCentered: true, verticalCentered: true, printTitlesRow: '1:1' })
      expect(sheet.getColumn(1).width).toBeCloseTo(pointsToExcelWidth(table.filenameWidth))
      expect(sheet.getColumn(2).width).toBeCloseTo(pointsToExcelWidth(table.columns[0].width))
      expect(sheet.getRow(1).height).toBe(table.style.headingHeight)
      table.rows.forEach((item, rowIndex) => {
        expect(sheet.getRow(rowIndex + 2).height).toBe(item.height)
        expect(sheet.getCell(rowIndex + 2, 2).value).toBe(item.row.cells.length.value! / 10)
      })
      const xml = await zip.file(`xl/worksheets/sheet${index + 1}.xml`)!.async('string')
      expect(xml).not.toContain('<brk ')
      // ExcelJS reads font sizes with parseInt; check the saved XML for fractional precision.
      const styles = await zip.file('xl/styles.xml')!.async('string')
      const styleId = Number(xml.match(/<c r="B2" s="(\d+)"/)![1])
      const formats = styles.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)![1].match(/<xf\b[^>]*>/g)!
      const fontId = Number(formats[styleId].match(/fontId="(\d+)"/)![1])
      const fonts = styles.match(/<fonts\b[^>]*>([\s\S]*?)<\/fonts>/)![1].match(/<font>[\s\S]*?<\/font>/g)!
      expect(Number(fonts[fontId].match(/<sz val="([^"]+)"/)![1])).toBe(table.style.fonts.value.size)
    }
    expect(workbook.worksheets[0].getCell('B2').font.size).not.toBe(workbook.worksheets[1].getCell('B2').font.size)
    const last = workbook.worksheets.at(-1)!
    expect(last.getCell(last.rowCount, 1).text).toBe('unknown')
    const combined = createPrintPreview(view, 'portrait', measure, false)[mode]!
    const oneSheet = createExcelReport(view, new Date(), undefined, combined.percent, combined)
    expect(oneSheet.worksheets).toHaveLength(1)
    expect(oneSheet.worksheets[0].rowCount).toBe(view.rows.length + 1)
  })
  it.each(['portrait', 'landscape'] as const)('measures long diagnostics locally and paints every page centred in %s', orientation => {
    const view = makeView(1, 1)
    view.rows[0] = { ...view.rows[0], name: '長檔案名稱'.repeat(30), status: { ...view.rows[0].status, detail: '無法判斷的原因'.repeat(40) } }
    const fitted = createPrintPreview(view, orientation, measure).onePageLayout!
    expect(fitted.pages).toHaveLength(2)
    expect(fitted.pages[0].percent).toBeLessThan(fitted.pages[1].percent)
    expect(fitted.pages[0].rows[0].nameLines.join('')).toBe(view.rows[0].name)
    expect(fitted.pages[0].rows[0].detailLines.join('')).toBe(view.rows[0].status.detail)
    const ctx = {
      setTransform: vi.fn(), fillRect: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(),
      fillText: vi.fn(), measureText: (value: string) => ({ width: value.length * 6 }),
      beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
    }
    const canvas = { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement
    fitted.pages.forEach((page, index) => {
      renderReportPage(canvas, fitted, index, 2, new AbortController().signal)
      expect(ctx.translate).toHaveBeenLastCalledWith((fitted.width - page.width) / 2, 0)
      expect(page.tableY).toBeCloseTo(fitted.height - page.rows.at(-1)!.y - page.rows.at(-1)!.height)
    })
    expect(ctx.stroke).not.toHaveBeenCalled() // Each page's final row still has no bottom line.
  })
})
