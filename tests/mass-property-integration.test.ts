import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { analyzeAnc } from '../src/domain/analyze'
import { calculateBatProperties } from '../src/domain/bat-properties'
import { createDefaultBatchDisplay, normalizeBatchDisplay, persistentBatchDisplay } from '../src/domain/batch-display'
import { appendSessionFiles, createBatchSession, restoreBatchSession } from '../src/services/batch-session'
import { buildBatchView, reportCellValue } from '../src/features/batch/view-model'
import { allMetricIds } from '../src/features/batch/columns'
import { formatBalancePoint, formatInertia, inertiaDisplay } from '../src/lib/mass-property-display'
import { inertiaFromKgM2 } from '../src/domain/mass-property-units'
import { initialMaterialSettings } from '../src/config/weight'
import { ResultDialog } from '../src/features/batch/result-dialog'
import { MobilePreviewDialog } from '../src/components/mobile-preview-dialog'
import { MobileResultView } from '../src/components/mobile-result-view'
import { createPrintPreview } from '../src/reports/print-preview'
import { createExcelReport } from '../src/reports/excel-report'
import { textUnits } from '../src/features/batch/column-layout'

const source = readFileSync(new URL('./fixtures/case-001.anc', import.meta.url), 'utf8')
const result = analyzeAnc(source, { name: 'physics.anc', size: source.length }, undefined, undefined, 5)
if (result.status !== 'calculated') throw new Error('Expected real calculated bat')
const entry = { id: 'bat', source: result.source, state: { status: 'result' as const, result } }
const units = { balance: 'cm', inertia: 'kg-cm2' } as const
const target = { min: 800.01, max: 820.02 }
const properties = calculateBatProperties(result, initialMaterialSettings, target)
const measure = (value: string, size: number) => textUnits(value) * size * 0.5

describe('mass property presentation contract', () => {
  it('uses one target range in table, desktop detail, mobile card and mobile 3D', () => {
    const view = buildBatchView([entry], allMetricIds, { key: 'name', direction: 'asc' }, { material: initialMaterialSettings, requirements: { bat: target } })
    expect(view.rows[0].cells.moi.value).toBe(properties.moiKgM2!.min)
    const markup = [
      renderToStaticMarkup(createElement(ResultDialog, { entry, material: initialMaterialSettings, requirement: target, massUnits: units, diameterAllowanceMm: 0, onDismiss() {} })),
      renderToStaticMarkup(createElement(MobilePreviewDialog, { result, properties, massUnits: units, diameterAllowanceMm: 0, onClose() {} })),
      renderToStaticMarkup(createElement(MobileResultView, { entry, material: initialMaterialSettings, requirement: target, massUnits: units, weightUnit: 'g', lengthUnit: 'cm', onMaterialOpen() {}, onOpenLibrary() {} })),
    ]
    for (const rendered of markup) {
      expect(rendered).toContain(inertiaDisplay(properties.moiKgM2, units.inertia))
      expect(rendered).toContain(formatBalancePoint(properties.balancePointMm!, units.balance))
    }
    expect(markup[0]).not.toContain('data-testid="volume-value"')
    expect(markup[0]).toContain('data-testid="retained-length"')
    expect(markup[1]).toContain('data-testid="property-weight"><span>800 – 820</span>')
  })
  it('shows balance without weight, with missing MOI and no invented mass', () => {
    const empty = calculateBatProperties(result, initialMaterialSettings, null)
    const markup = renderToStaticMarkup(createElement(MobilePreviewDialog, { result, properties: empty, massUnits: units, diameterAllowanceMm: 0, onClose() {} }))
    expect(markup).toContain('data-testid="property-weight"><span>—</span>')
    expect(markup).toContain('data-testid="property-moi"><span>—</span>')
    expect(markup).toContain(formatBalancePoint(empty.balancePointMm!, 'cm'))
  })
  it('sorts full-precision MOI ranges even when the displayed values match', () => {
    const b = { ...entry, id: 'b' }, a = { ...entry, id: 'a' }
    const view = buildBatchView([b, a], ['moi'], { key: 'moi', direction: 'asc' }, { material: initialMaterialSettings, requirements: { a: { min: 800.001, max: 800.001 }, b: { min: 800.002, max: 800.002 } } })
    expect(view.rows.map(row => row.id)).toEqual(['a', 'b'])
    expect(view.rows[0].cells.moi.display).toBe(view.rows[1].cells.moi.display)
  })
  it('exports unrounded numeric values in either unit system and formats them separately', () => {
    for (const chosen of [units, { balance: 'in', inertia: 'oz-in2' } as const]) {
      const view = buildBatchView([entry], ['balancePoint', 'moi'], { key: 'name', direction: 'asc' }, { material: initialMaterialSettings, requirements: { bat: { min: 800.01, max: 800.01 } } }, undefined, undefined, 0, false, chosen)
      const row = view.rows[0], [balance, moi] = view.columns
      expect(reportCellValue(row.cells.balancePoint, balance)).toBe(properties.balancePointMm! / (chosen.balance === 'cm' ? 10 : 25.4))
      expect(reportCellValue(row.cells.moi, moi)).toBe(inertiaFromKgM2(row.cells.moi.value!, chosen.inertia))
      const sheet = createExcelReport(view).worksheets[0]
      expect(sheet.getCell('B2').value).toBe(reportCellValue(row.cells.balancePoint, balance))
      expect(sheet.getCell('C2').value).toBe(reportCellValue(row.cells.moi, moi))
      expect(sheet.getCell('B2').numFmt).toBe('#,##0.0')
      expect(sheet.getCell('C2').numFmt).toBe('#,##0')
      expect(row.cells.moi.display).toBe(formatInertia(row.cells.moi.value!, chosen.inertia))
    }
  })
  it('fits all eight selected columns in both report orientations without dropping values', () => {
    const view = buildBatchView([entry], allMetricIds, { key: 'name', direction: 'asc' }, { material: initialMaterialSettings, requirements: { bat: target } })
    for (const orientation of ['portrait', 'landscape'] as const) {
      const preview = createPrintPreview(view, orientation, measure)
      expect(preview.maximumLayout).not.toBeNull()
      expect(preview.maximumLayout!.widthOverflow).toBe(false)
      expect(preview.maximumLayout!.table.columns.map(item => item.column.id)).toEqual(allMetricIds)
      expect(preview.maximumLayout!.pages[0].rows[0].row.cells.moi.value).toBe(properties.moiKgM2!.min)
    }
  })
})

describe('temporary column visibility with persistent batch files', () => {
  it('keeps new columns during file additions but resets only those columns when reopening', () => {
    const session = createBatchSession([new File([source], 'a.anc')])
    expect(session.display).toEqual(createDefaultBatchDisplay())
    session.display = normalizeBatchDisplay({ visible: ['length', 'moi', 'balancePoint'], showMeasurementDistances: true })
    const added = appendSessionFiles(session, [new File([source], 'b.anc')])
    expect(added.display.visible).toEqual(['length', 'moi', 'balancePoint'])
    expect(persistentBatchDisplay(added.display)).toEqual({ visible: ['length'], showMeasurementDistances: true })
    const restored = restoreBatchSession({ version: 2, id: added.id, files: added.files }, { sessionId: added.id, values: {} }, { version: 2, sessionId: added.id, value: added.display })!
    expect(restored.files).toHaveLength(2)
    expect(restored.display).toEqual({ visible: ['length'], showMeasurementDistances: true })
    expect(added.display.visible).toContain('moi')
  })
})
