import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { analyzeAnc } from '../src/domain/analyze'
import { buildBatchView } from '../src/features/batch/view-model'
import { allMetricIds } from '../src/features/batch/columns'
import { textUnits } from '../src/features/batch/column-layout'
import { buildPdfLayout } from '../src/reports/pdf-layout'
import { reportStyle, scaledReportStyle } from '../src/config/report'
import { pdfPageSize } from '../src/config/pdf'
import { text } from '../src/i18n/zh-TW'
import type { AnalysisEntry } from '../src/services/analysis-state'

const raw = readFileSync(new URL('./fixtures/case-001.anc', import.meta.url), 'utf8')
const entries: AnalysisEntry[] = Array.from({ length: 43 }, (_, index) => {
  const source = { name: `球棒${index + 1}.anc`, size: raw.length }
  return { id: String(index), source, state: { status: 'result', result: analyzeAnc(raw, source) } }
})
const material = { referenceDensity: 0.7, volumeCm3: 3000, weightG: null, weightErrorPercent: -3 }
const view = buildBatchView(entries, allMetricIds, { key: 'name', direction: 'desc' },
  { material, requirements: { '0': { min: 600, max: 650 } }, weightUnit: 'both' }, 'both')
const measure = (value: string, size: number) => textUnits(value) * size * 0.5

describe('A4 PDF pagination', () => {
  it.each(['portrait', 'landscape'] as const)('keeps complete ordered rows, readable font sizes and repeating headers in %s', orientation => {
    const original = JSON.stringify(view)
    const scale = orientation === 'portrait' ? 85 : 100
    const style = scaledReportStyle(scale)
    const result = buildPdfLayout(view, orientation, measure, scale)
    expect({ width: result.width, height: result.height }).toEqual(pdfPageSize(orientation))
    expect(result.pages.length).toBeGreaterThan(1)
    expect(result.tableOffsetX).toBeGreaterThanOrEqual(0)
    expect(result.pages.flatMap(page => page.rows.map(row => row.row.id))).toEqual(view.rows.map(row => row.id))
    for (const page of result.pages) {
      expect(page.tableY).toBeGreaterThanOrEqual(reportStyle.padding)
      expect(page.tableY).toBeCloseTo(result.height - (page.rows.at(-1)!.y + page.rows.at(-1)!.height))
      expect(page.columns.map(item => item.column.id)).toEqual(allMetricIds)
      expect(page.rows[0].y).toBeCloseTo(page.tableY + style.headingHeight)
      expect(page.rows.at(-1)!.y + page.rows.at(-1)!.height).toBeLessThanOrEqual(result.height - reportStyle.padding + 0.01)
      expect(page.rows.every(row => row.height / 2 >= style.fonts.value.size + style.rowPadding)).toBe(true)
    }
    expect(JSON.stringify(view)).toBe(original)
  })
  it('wraps filenames to available space and preserves all content even when a single row spans pages', () => {
    const row = { ...view.rows[0], name: '超長中文球棒檔案名稱'.repeat(800), status: { ...view.rows[0].status, detail: '判斷原因'.repeat(600) } }
    const result = buildPdfLayout({ ...view, rows: [row] }, 'portrait', measure)
    const parts = result.pages.flatMap(page => page.rows)
    expect(result.pages.length).toBeGreaterThan(2)
    expect(parts.flatMap(part => part.nameLines).join('')).toBe(row.name)
    expect(parts.flatMap(part => part.detailLines).join('')).toBe(row.status.detail)
    expect(parts.every(part => part.row.cells === row.cells && part.index === 0)).toBe(true)
    expect(parts.every(part => part.y + part.height <= result.height - reportStyle.padding + 0.01)).toBe(true)
  })
  it('centres a narrow table, supports hidden metrics and keeps unavailable values', () => {
    const row = { ...view.rows[0], name: 'a.anc' }
    const result = buildPdfLayout({ ...view, columns: [], rows: [row] }, 'portrait', measure)
    expect(result.pages).toHaveLength(1)
    expect(result.tableOffsetX).toBeGreaterThan(100)
    expect(result.pages[0].columns).toEqual([])
    expect(result.pages[0].rows[0].row).toBe(row)
  })
  it('rejects overflowing columns explicitly instead of clipping or shrinking text', () => {
    const wide = { ...view, columns: view.columns.map(column => ({ ...column, label: '非常長的欄位名稱'.repeat(100) })) }
    expect(() => buildPdfLayout(wide, 'portrait', measure)).toThrow(text.reportTooWide)
  })
  it.each(['portrait', 'landscape'] as const)('centres each page independently at different scales in %s without changing pagination', orientation => {
    const narrow = { ...view, columns: view.columns.filter(column => column.id === 'length') }
    for (const scale of [50, 100, 150]) {
      const result = buildPdfLayout(narrow, orientation, measure, scale)
      const style = result.table.style
      const rowHeight = result.table.rows[0].height
      const rowsPerPage = Math.floor((result.height - style.padding * 2 - style.headingHeight) / rowHeight)
      expect(result.pages.length).toBe(Math.ceil(narrow.rows.length / rowsPerPage))
      expect(result.pages.flatMap(page => page.rows.map(item => item.row.id))).toEqual(narrow.rows.map(row => row.id))
      expect(result.tableOffsetX + style.padding).toBeCloseTo(result.width - (result.tableOffsetX + result.table.width - style.padding))
      for (const page of result.pages) {
        const last = page.rows.at(-1)!
        expect(page.tableY).toBeCloseTo(result.height - last.y - last.height)
        expect(page.tableY).toBeGreaterThanOrEqual(style.padding)
        expect(page.rows[0].y).toBeCloseTo(page.tableY + style.headingHeight)
        page.rows.slice(1).forEach((row, index) => expect(row.y).toBeCloseTo(page.rows[index].y + page.rows[index].height))
      }
      const first = result.pages[0], last = result.pages.at(-1)!
      if (last.rows.length < first.rows.length) expect(last.tableY).toBeGreaterThan(first.tableY)
      // Native Excel row heights still come from the unpaginated table.
      expect(result.table.rows[0].y).toBe(style.padding + style.headingHeight)
    }
  })
  it('centres a heading-only page and a single-row page', () => {
    for (const rows of [[], view.rows.slice(0, 1)]) {
      const result = buildPdfLayout({ ...view, columns: [], rows }, 'portrait', measure)
      const page = result.pages[0]
      const contentHeight = page.style.headingHeight + page.rows.reduce((sum, row) => sum + row.height, 0)
      expect(result.pages).toHaveLength(1)
      expect(page.tableY + contentHeight / 2).toBeCloseTo(result.height / 2)
    }
  })
})
