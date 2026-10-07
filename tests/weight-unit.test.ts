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
import { buildReportLayout } from '../src/reports/png-layout'
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
    expect(parseRequirement('30', '28', 'oz').error).toBe('range')
    expect(parseRequirement('1e309', '1e309', 'oz').error).toBe('positive')
    expect(inputWeightUnit('both')).toBe('g')
  })
  it('formats grams as integers and ounces as one decimal including both range endpoints', () => {
    expect(weightDisplay(gramsPerOunce * 28, undefined, 'oz')).toEqual({ display: '28.0' })
    expect(weightDisplay(600.4, 650.4, 'g')).toEqual({ display: '600 – 650' })
    expect(weightDisplay(gramsPerOunce * 28, gramsPerOunce * 30, 'both')).toEqual({ display: '794 – 850 g', secondary: '28.0 – 30.0 oz' })
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
  it.each(['g', 'oz', 'both'] as const)('saves %s with the correct headings, precision and A4 setup', async mode => {
    const view = makeView(mode)
    const data = await createExcelReport(view).xlsx.writeBuffer()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(data)
    const sheet = workbook.worksheets[0]
    const cell = sheet.getCell('C2'), weight = view.rows[0].cells.materialWeight
    if (mode === 'both') {
      expect(cell.text).toBe(`${weight.display}\n${weight.secondary}`)
      expect(cell.value).toMatchObject({ richText: [{ text: weight.display, font: { size: 10 } }, { text: '\n' + weight.secondary, font: { size: 10 } }] })
      expect(sheet.getCell('C1').text).toBe('木料重量 g / oz')
    } else {
      expect(cell.value).toBe(fromGrams(weight.value!, mode))
      expect(cell.numFmt).toBe(mode === 'oz' ? '#,##0.0' : '#,##0')
    }
    expect(sheet.getCell('B2').value).toBe(view.rows[0].cells.volume.value)
    expect(sheet.getCell('D2').value).toBe(view.rows[0].cells.batWeight.value)
    expect(sheet.getCell('D2').numFmt).toBe('#,##0')
    expect(sheet.getCell('D1').text).toBe('預計重量 g')
    expect(sheet.pageSetup).toMatchObject({ orientation: 'portrait', fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:1' })
    expect(sheet.getRow(2).height).toBeGreaterThanOrEqual(mode === 'both' ? 54 : 32)
    expect(sheet.getCell('D2').font.color?.argb).toBe('FF262626')
  })
  it('keeps fixed requirements in grams while converting material weights and dual-unit ranges', async () => {
    const fixed = makeView('oz', { sample: { min: 600.25, max: 600.25 } })
    expect(createExcelReport(fixed).getWorksheet(1)!.getCell('D2').value).toBe(600.25)
    expect(createExcelReport(fixed).getWorksheet(1)!.getCell('C2').value).toBe(fixed.rows[0].cells.materialWeight.value! / gramsPerOunce)
    const dual = makeView('both', { sample: { min: 600, max: 650 } })
    const measure = (value: string, size: number) => [...value].length * size
    const layout = buildReportLayout(dual, measure)
    expect(layout.columns[1].width).toBeGreaterThanOrEqual(measure(dual.rows[0].cells.materialWeight.secondary!, 14) + 40)
    expect(layout.rows[0].height).toBeGreaterThanOrEqual(76)
    const cell = createExcelReport(dual).getWorksheet(1)!.getCell('C2')
    expect(cell.text).toBe(`${dual.rows[0].cells.materialWeight.display}\n${dual.rows[0].cells.materialWeight.secondary}`)
  })
})
