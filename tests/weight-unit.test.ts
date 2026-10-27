import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import ExcelJS from 'exceljs'
import { gramsPerOunce, fromGrams, toGrams, inputWeightUnit, type WeightDisplayMode } from '../src/domain/weight-unit'
import { weightDisplay, editableWeight } from '../src/lib/weight-display'
import { parseRequirement } from '../src/features/batch/weight-input'
import { readWeightUnit, saveWeightUnit } from '../src/services/weight-unit-storage'
import { analyzeAnc } from '../src/domain/analyze'
import { buildBatchView, defaultSort } from '../src/features/batch/view-model'
import { defaultMetricIds } from '../src/features/batch/columns'
import { createExcelReport } from '../src/reports/excel-report'
import { buildReportLayout } from '../src/reports/report-layout'
import { buildColumnLayout, metricFonts } from '../src/features/batch/column-layout'
import { batchTableStyle } from '../src/config/batch'
import { reportStyle } from '../src/config/report'
import { paintReportPage } from '../src/reports/report-canvas'
import { palette } from '../src/config/theme'
import type { AnalysisEntry } from '../src/services/analysis-state'

const raw = readFileSync(new URL('./fixtures/case-001.anc', import.meta.url), 'utf8')
const source = { name: 'sample.anc', size: raw.length }
const sample: AnalysisEntry = { id: 'sample', source, state: { status: 'result', result: analyzeAnc(raw, source) } }
const material = { referenceDensity: 0.7, volumeCm3: 3000, weightG: null, weightErrorPercent: 0 }
const makeView = (weightUnit: WeightDisplayMode, requirements = {}) => buildBatchView([sample], defaultMetricIds, defaultSort, { material, requirements, weightUnit })

describe('weight units and canonical gram data', () => {
  it('converts without display rounding and preserves untouched ounce inputs exactly', () => {
    expect(toGrams(1, 'oz')).toBe(gramsPerOunce)
    expect(fromGrams(gramsPerOunce * 28, 'oz')).toBe(28)
    const original = { min: 600.123456789, max: 650.987654321 }
    expect(parseRequirement(editableWeight(original.min, 'oz'), editableWeight(original.max, 'oz'), 'oz', original).range).toEqual(original)
    expect(parseRequirement('28', '30', 'oz').range).toEqual({ min: 28 * gramsPerOunce, max: 30 * gramsPerOunce })
    expect(parseRequirement('30', '28', 'oz').range).toEqual({ min: 28 * gramsPerOunce, max: 30 * gramsPerOunce })
    expect(parseRequirement('1e309', '1e309', 'oz').error).toBe('positive')
    expect(inputWeightUnit('both')).toBe('g')
  })
  it('formats grams as integers and ounces as one decimal including both range endpoints', () => {
    expect(weightDisplay(gramsPerOunce * 28, undefined, 'oz')).toEqual({ display: '28.0' })
    expect(weightDisplay(600.4, 650.4, 'g')).toEqual({ display: '600 – 650' })
    expect(weightDisplay(gramsPerOunce * 28, gramsPerOunce * 30, 'both')).toEqual({ display: '28.0 – 30.0', secondary: '794 – 850' })
  })
  it('changes presentation without mutating geometry, canonical weights or sorting order', () => {
    const second = { ...sample, id: 'second', source: { ...source, name: 'second.anc' } }
    const requirements = { sample: { min: 600.25, max: 650.75 }, second: { min: 600.26, max: 640 } }
    for (const mode of ['g', 'oz', 'both'] as const) {
      const view = buildBatchView([second, sample], defaultMetricIds, { key: 'batWeight', direction: 'asc' }, { material, requirements, weightUnit: mode })
      expect(view.rows.map(row => row.id)).toEqual(['sample', 'second'])
      expect(view.rows[0].cells.batWeight.value).toBe(600.25)
      expect(view.rows[0].cells.batWeight.display).toBe('600 – 651')
      expect(view.rows[0].cells.batWeight.secondary).toBeUndefined()
      expect(view.columns.find(column => column.id === 'batWeight')?.unit).toBe('g')
      expect(view.rows[0].cells.volume).toEqual(makeView('g').rows[0].cells.volume)
    }
    expect(requirements.sample).toEqual({ min: 600.25, max: 650.75 })
    const failed = { ...sample, state: { status: 'loading' as const, source } }
    expect(buildBatchView([failed], defaultMetricIds, defaultSort, { material, requirements: {}, weightUnit: 'both' }).rows[0].cells.batWeight).toEqual({ value: null, display: '—' })
  })
  it('remembers the choice and falls back safely when saved settings or storage are unavailable', () => {
    let saved: string | null = null
    const storage = { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value } }
    expect(readWeightUnit(storage).mode).toBe('g')
    expect(saveWeightUnit(storage, 'both')).toBe(true)
    expect(readWeightUnit(storage).mode).toBe('both')
    saved = 'invalid'
    expect(readWeightUnit(storage).mode).toBe('g')
    const blocked = { getItem: () => { throw Error() }, setItem: () => { throw Error() } }
    expect(readWeightUnit(blocked)).toEqual({ mode: 'g', unavailable: true })
    expect(saveWeightUnit(blocked, 'oz')).toBe(false)
  })
})

describe('reports with selected weight units', () => {
  it('paints oz in white on the upper dark half and grams below, with stronger report separators', () => {
    const view = makeView('both')
    const layout = buildReportLayout(view, (value, size) => value.length * size)
    const column = layout.columns.find(item => item.column.id === 'materialWeight')!
    const row = layout.rows[0]
    const words: { text: string; x: number; y: number; color: string }[] = []
    const fills: { x: number; y: number; height: number; color: string }[] = []
    const strokes: { color: string; width: number }[] = []
    const ctx = {
      fillStyle: '', strokeStyle: '', lineWidth: 0,
      measureText: (value: string) => ({ width: value.length * 6 }),
      fillText(value: string, x: number, y: number) { words.push({ text: value, x, y, color: this.fillStyle }) },
      fillRect(x: number, y: number, _width: number, height: number) { fills.push({ x, y, height, color: this.fillStyle }) },
      beginPath() {}, moveTo() {}, lineTo() {},
      stroke() { strokes.push({ color: this.strokeStyle, width: this.lineWidth }) },
    }
    paintReportPage(ctx as unknown as CanvasRenderingContext2D, layout, new AbortController().signal)
    const center = column.x + column.width / 2
    const values = words.filter(word => word.x === center && word.y >= row.y)
    const grams = view.rows[0].cells.materialWeight.value!
    expect(values.map(word => word.text)).toEqual([(grams / gramsPerOunce).toFixed(1), new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 }).format(grams)])
    expect(values[0].color).toBe(palette.white)
    expect(values[0].y).toBeLessThan(row.y + row.height / 2)
    expect(values[1].color).toBe(palette.text)
    expect(values[1].y).toBeGreaterThan(row.y + row.height / 2)
    expect(fills.filter(fill => fill.color === palette.accent)).toEqual([{ x: column.x, y: row.y, height: row.height / 2, color: palette.accent }])
    expect(strokes).toEqual([])
    const second = { ...row, index: 1, y: row.y + row.height }
    paintReportPage(ctx as unknown as CanvasRenderingContext2D, { ...layout, rows: [row, second] }, new AbortController().signal)
    expect(strokes).toEqual([{ color: '#c8c8c8', width: 1 }])
  })
  it.each(['g', 'oz', 'both'] as const)('saves %s with the correct headings, precision and A4 setup', async mode => {
    const view = makeView(mode)
    const data = await createExcelReport(view).xlsx.writeBuffer()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(data)
    const sheet = workbook.worksheets[0]
    const cell = sheet.getCell('C2'), weight = view.rows[0].cells.materialWeight
    expect(cell.border.bottom).toEqual({ style: 'hair', color: { argb: 'FFE5E5E5' } })
    expect(cell.alignment).toMatchObject({ horizontal: 'center', vertical: 'middle' })
    if (mode === 'both') {
      expect(cell.text).toBe(`${weight.display}\n\n${weight.secondary}`)
      expect(cell.value).toMatchObject({ richText: [{ text: weight.display, font: { size: 12 } }, { text: '\n\n' + weight.secondary, font: { size: 12 } }] })
      expect(sheet.getCell('C1').text).toBe('木料重量 oz / g')
      const rich = cell.value as ExcelJS.CellRichTextValue
      expect(rich.richText[0].font?.color?.argb).toBe('FFFFFFFF')
      expect(rich.richText[1].font?.color?.argb).toBe('FF404040')
      expect(cell.fill).toMatchObject({ type: 'gradient', gradient: 'angle', degree: 90, stops: [
        { position: 0, color: { argb: 'FF333333' } },
        { position: 0.4999, color: { argb: 'FF333333' } },
        { position: 0.5001, color: { argb: 'FFFFFFFF' } },
        { position: 1, color: { argb: 'FFFFFFFF' } },
      ] })
    } else {
      expect(cell.value).toBe(fromGrams(weight.value!, mode))
      expect(cell.numFmt).toBe(mode === 'oz' ? '#,##0.0' : '#,##0')
      expect(cell.fill.type).toBe('pattern')
    }
    expect(sheet.getCell('B2').value).toBe(view.rows[0].cells.volume.value)
    expect(sheet.getCell('D2').value).toBe(view.rows[0].cells.batWeight.value)
    expect(sheet.getCell('D2').numFmt).toBe('#,##0')
    expect(sheet.getCell('D1').text).toBe('預計重量 g')
    expect(sheet.pageSetup).toMatchObject({ orientation: 'portrait', fitToPage: false, scale: 100, printTitlesRow: '1:1' })
    expect(sheet.getRow(2).height).toBeGreaterThanOrEqual(reportStyle.minimumRowHeight)
    expect(sheet.getCell('D2').font.color?.argb).toBe('FF262626')
  })
  it('keeps fixed requirements in grams while converting material weights and dual-unit ranges', async () => {
    const fixed = makeView('oz', { sample: { min: 600.25, max: 600.25 } })
    expect(createExcelReport(fixed).getWorksheet(1)!.getCell('D2').value).toBe(600.25)
    expect(createExcelReport(fixed).getWorksheet(1)!.getCell('C2').value).toBe(fixed.rows[0].cells.materialWeight.value! / gramsPerOunce)
    const dual = makeView('both', { sample: { min: 600, max: 650 } })
    const measure = (value: string, size: number) => [...value].length * size
    const layout = buildReportLayout(dual, measure)
    expect(layout.columns[1].width).toBeGreaterThanOrEqual(measure(dual.rows[0].cells.materialWeight.secondary!, reportStyle.fonts.value.size) + reportStyle.cellPadding * 2)
    expect(layout.rows[0].height).toBeGreaterThanOrEqual(reportStyle.minimumRowHeight)
    const cell = createExcelReport(dual).getWorksheet(1)!.getCell('C2')
    expect(cell.text).toBe(`${dual.rows[0].cells.materialWeight.display}\n\n${dual.rows[0].cells.materialWeight.secondary}`)
  })
  it('gives both wood-weight lines the same typography and enough width and half-cell height', () => {
    const view = makeView('both', { sample: { min: 600, max: 650 } })
    const weight = view.columns.find(column => column.id === 'materialWeight')!
    expect(metricFonts(weight, batchTableStyle).secondary).toEqual(metricFonts(weight, batchTableStyle).value)
    const sized = { ...view, rows: view.rows.map(row => ({ ...row, cells: { ...row.cells, materialWeight: { ...row.cells.materialWeight, secondary: '123,456,789.0 – 987,654,321.0' } } })) }
    const measure = (value: string, font: { size: number }) => value.length * font.size
    const width = buildColumnLayout(sized, batchTableStyle, measure).columns.find(item => item.column.id === 'materialWeight')!.width
    expect(width).toBeGreaterThanOrEqual(sized.rows[0].cells.materialWeight.secondary!.length * 17 + 40)
    const report = buildReportLayout(view, (value, size) => value.length * size)
    expect(report.rows[0].height / 2).toBeGreaterThanOrEqual(reportStyle.fonts.value.size + reportStyle.rowPadding)
    const lengthView = buildBatchView([sample], ['length'], defaultSort, undefined, 'both')
    const length = lengthView.columns[0]
    expect(length.splitUnits).toBeUndefined()
    expect(metricFonts(length, batchTableStyle).secondary).toEqual(batchTableStyle.fonts.detail)
  })
  it('preserves one physical row per bat, stripes, missing weights and length styling after saving', async () => {
    const long = { ...sample, id: 'long', source: { ...source, name: '長名稱'.repeat(30) + '.anc' } }
    const pending = { ...sample, id: 'pending', source: { ...source, name: 'zzz.anc' }, state: { status: 'loading' as const, source } }
    const view = buildBatchView([sample, long, pending], ['materialWeight', 'length'], defaultSort,
      { material, requirements: { pending: { min: 600, max: 650 } }, weightUnit: 'both' }, 'both')
    const saved = await createExcelReport(view).xlsx.writeBuffer()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(saved)
    const sheet = workbook.worksheets[0]
    expect(sheet.rowCount).toBe(4)
    expect(sheet.pageSetup.printArea).toBe('A1:C4')
    expect(sheet.getCell('B3').fill).toMatchObject({ type: 'gradient', stops: [
      { position: 0, color: { argb: 'FF333333' } },
      { position: 0.4999, color: { argb: 'FF333333' } },
      { position: 0.5001, color: { argb: 'FFFAFAFA' } },
      { position: 1, color: { argb: 'FFFAFAFA' } },
    ] })
    const longIndex = view.rows.findIndex(row => row.id === 'long') + 2
    const rich = sheet.getCell(longIndex, 2).value as ExcelJS.CellRichTextValue
    expect(rich.richText[1].text.match(/^\n+/)![0].length).toBeGreaterThan(2)
    expect(sheet.getCell('B4').value).toBe('—')
    expect(sheet.getCell('B4').fill.type).toBe('pattern')
    expect(sheet.getCell('C2').fill.type).toBe('pattern')
    expect(sheet.getCell('C2').text).toBe(`${view.rows[0].cells.length.display}\n${view.rows[0].cells.length.secondary}`)
  })
})
