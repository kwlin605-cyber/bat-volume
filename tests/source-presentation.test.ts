import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { AnalysisEntry } from '../src/services/analysis-state'
import { buildBatchView } from '../src/features/batch/view-model'
import { allMetricIds } from '../src/features/batch/columns'
import { textUnits } from '../src/features/batch/column-layout'
import { buildPdfLayout } from '../src/reports/pdf-layout'
import { createExcelReport } from '../src/reports/excel-report'
import { createPrintPreview } from '../src/reports/print-preview'
import { reportView } from '../src/reports/report-view'
import { text } from '../src/i18n/zh-TW'
import { ResultCard } from '../src/components/result-card'
import { MobileResultView } from '../src/components/mobile-result-view'
import BatchResults from '../src/features/batch/batch-results'

const material = { referenceDensity: 0.7, volumeCm3: 3000, weightG: null, weightErrorPercent: 0 }
const makeEntry = (id: string, origin?: AnalysisEntry['origin'], name = '未命名.anc'): AnalysisEntry => {
  const source = { name, size: 10 }
  return { id, source, origin, state: { status: 'result', result: { status: 'undetermined', source, code: 'noProfile' } } }
}
const entries = [
  makeEntry('first', { kind: 'preset', id: '/src/assets/anc/甲/未命名.anc', label: '甲' }),
  makeEntry('nested', { kind: 'preset', id: '/src/assets/anc/甲/資料夾/未命名.anc', label: '甲／資料夾' }),
  makeEntry('upload', { kind: 'upload' }), makeEntry('legacy'), makeEntry('unique', undefined, '另一支.anc'),
]
const viewFor = (items: AnalysisEntry[]) => buildBatchView(items, allMetricIds, { key: 'name', direction: 'asc' }, { material, requirements: { first: { min: 800, max: 850 } } })
const measure = (value: string, size: number) => textUnits(value) * size * 0.5

describe('source labels explain duplicate names without changing diagnostics or calculations', () => {
  it('distinguishes duplicate rows, weight controls, previews and removal controls by accessible name', () => {
    const markup = renderToStaticMarkup(createElement(BatchResults, {
      diameterAllowanceMm: 0, material, weightUnit: 'g', lengthUnit: 'cm', entries: entries.slice(0, 2), requirements: {},
      display: { visible: allMetricIds, showMeasurementDistances: false }, sort: { key: 'name', direction: 'asc' }, removing: true,
      onDiameterAllowanceChange() {}, onWeightUnitChange() {}, onLengthUnitChange() {}, onMaterialOpen() {},
      onDisplayChange() {}, onSortChange() {}, onRemove() {}, onRequirementChange() {},
    }))
    for (const label of ['甲', '甲／資料夾']) {
      expect(markup).toContain(`aria-label="${text.selectBat} 未命名 ${label}"`)
      expect(markup).toContain(`aria-label="${text.previewFile} 未命名 ${label}"`)
      expect(markup).toContain(`aria-label="${text.removeFile} 未命名 ${label}"`)
    }
    expect(markup.match(/class="source-tag"/g)).toHaveLength(2)
    expect(markup).toContain('找不到完整的加工輪廓。')
  })
  it('labels only repeated displayed names and distinguishes presets, uploads and legacy records', () => {
    const view = viewFor(entries)
    expect(view.rows.map(row => [row.id, row.sourceLabel])).toEqual(expect.arrayContaining([
      ['first', '甲'], ['nested', '甲／資料夾'], ['upload', text.uploadedSource], ['legacy', text.unknownSource], ['unique', undefined],
    ]))
    expect(view.rows.every(row => row.status.detail === '找不到完整的加工輪廓。')).toBe(true)
    const single = viewFor([entries[0]])
    expect(single.rows[0].sourceLabel).toBeUndefined()
    expect(single.rows[0].cells).toEqual(view.rows.find(row => row.id === 'first')!.cells)
    expect(viewFor([entries[0], entries[4]]).rows.every(row => row.sourceLabel === undefined)).toBe(true)
    const extensionCase = viewFor([entries[0], { ...entries[1], source: { ...entries[1].source, name: '未命名.ANC' } }])
    expect(extensionCase.rows.every(row => row.sourceLabel)).toBe(true)
  })

  it.each(['presetRemoved', 'presetLoadFailed'] as const)('shows %s on desktop and mobile without a stale result or 3D preview', reason => {
    const entry: AnalysisEntry = { ...entries[0], state: { status: 'unavailable', source: entries[0].source, reason } }
    const card = renderToStaticMarkup(createElement(ResultCard, { state: entry.state }))
    const mobile = renderToStaticMarkup(createElement(MobileResultView, { entry, material, requirement: { min: 800, max: 850 }, weightUnit: 'g', lengthUnit: 'cm', onMaterialOpen() {}, onOpenLibrary() {} }))
    expect(card).toContain(text[reason])
    expect(mobile).toContain(text[reason])
    expect(card).not.toContain('data-testid="volume-value"')
    expect(mobile).not.toContain('mobile-3d-action-button')
    expect(mobile).not.toContain('source-tag')
    const row = viewFor([entry]).rows[0]
    expect(row.cells.volume.value).toBeNull()
    expect(row.cells.materialWeight.value).toBeNull()
    // A committed target is user input and remains available independently of geometry.
    expect(row.cells.batWeight.value).toBe(800)
    expect(row.cells.batWeight.maximum).toBe(850)
  })
})

describe('PDF source tags and unchanged Excel output', () => {
  it.each(['portrait', 'landscape'] as const)('keeps tags and the original diagnostic separate in %s', orientation => {
    const view = viewFor(entries)
    const layout = buildPdfLayout(view, orientation, measure, 70)
    expect(layout.pages.flatMap(page => page.rows.map(item => item.row.id))).toEqual(view.rows.map(row => row.id))
    for (const item of layout.table.rows) {
      expect(item.sourceLines.join('')).toBe(item.row.sourceLabel ?? '')
      expect(item.detailLines.join('')).toBe(item.row.status.detail)
      if (item.sourceInline) {
        const tag = layout.table.style.sourceTag
        expect(item.sourceOffsetX + measure(item.sourceLines[0], tag.fontSize) + (tag.paddingX + tag.borderWidth) * 2).toBeLessThanOrEqual(layout.table.filenameWidth - layout.table.style.cellPadding * 2)
      }
    }
  })

  it('wraps and paginates a long source without losing its name, diagnostic or numeric cells', () => {
    const view = viewFor(entries.slice(0, 2))
    const row = { ...view.rows[0], name: '未命名'.repeat(600), sourceLabel: '廠商／很長的資料夾'.repeat(500), status: { ...view.rows[0].status, detail: '找不到完整的加工輪廓。'.repeat(500) } }
    const result = buildPdfLayout({ ...view, rows: [row] }, 'portrait', measure, 100)
    const parts = result.pages.flatMap(page => page.rows)
    expect(result.pages.length).toBeGreaterThan(2)
    expect(parts.flatMap(part => part.nameLines).join('')).toBe(row.name)
    expect(parts.flatMap(part => part.sourceLines).join('')).toBe(row.sourceLabel)
    expect(parts.flatMap(part => part.detailLines).join('')).toBe(row.status.detail)
    expect(parts.every(part => part.row.cells === row.cells)).toBe(true)
    expect(parts.every(part => part.y + part.height <= result.height - result.table.style.padding + 0.01)).toBe(true)
  })

  it('omits source text and its layout space from Excel preview and the downloaded workbook', () => {
    const view = viewFor(entries)
    const output = reportView(view, 'xlsx')
    expect(reportView(view, 'pdf-portrait')).toBe(view)
    expect(output.rows.every(row => row.sourceLabel === undefined)).toBe(true)
    const preview = createPrintPreview(output, 'portrait', measure).baseline
    expect(preview.table.rows.every(row => row.sourceLines.length === 0)).toBe(true)
    const date = new Date('2026-01-01T00:00:00Z')
    const actual = createExcelReport(view, date, (value, font) => measure(value, font.size), 70)
    const expected = createExcelReport(output, date, (value, font) => measure(value, font.size), 70)
    expect(actual.model).toEqual(expected.model)
    expect(JSON.stringify(actual.model)).not.toContain('甲／資料夾')
    expect(JSON.stringify(actual.model)).toContain('找不到完整的加工輪廓。')
    expect(view.rows.some(row => row.sourceLabel)).toBe(true)
  })
})
