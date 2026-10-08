import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { analyzeAnc } from '../src/domain/analyze'
import { buildBatchView } from '../src/features/batch/view-model'
import { allMetricIds } from '../src/features/batch/columns'
import { textUnits } from '../src/features/batch/column-layout'
import { buildPdfLayout } from '../src/reports/pdf-layout'
import { reportStyle } from '../src/config/report'
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
    const result = buildPdfLayout(view, orientation, measure)
    expect({ width: result.width, height: result.height }).toEqual(pdfPageSize(orientation))
    expect(result.pages.length).toBeGreaterThan(1)
    expect(result.tableOffsetX).toBeGreaterThanOrEqual(0)
    expect(result.pages.flatMap(page => page.rows.map(row => row.row.id))).toEqual(view.rows.map(row => row.id))
    for (const page of result.pages) {
      expect(page.tableY).toBe(reportStyle.padding)
      expect(page.columns.map(item => item.column.id)).toEqual(allMetricIds)
      expect(page.rows[0].y).toBe(reportStyle.padding + reportStyle.headingHeight)
      expect(page.rows.at(-1)!.y + page.rows.at(-1)!.height).toBeLessThanOrEqual(result.height - reportStyle.padding + 0.01)
      expect(page.rows.every(row => row.height / 2 >= reportStyle.fonts.value.size + reportStyle.rowPadding)).toBe(true)
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
})
