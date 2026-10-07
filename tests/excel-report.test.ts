import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { analyzeAnc } from '../src/domain/analyze'
import { createExcelReport } from '../src/reports/excel-report'
import { buildBatchView, defaultSort } from '../src/features/batch/view-model'
import { geometryMetricIds as allMetricIds, defaultMetricIds } from '../src/features/batch/columns'
import type { AnalysisEntry } from '../src/services/analysis-state'
import corpus from './fixtures/corpus.json'
import { text } from '../src/i18n/zh-TW'

const entries: AnalysisEntry[] = corpus.map((sample, index) => {
  const raw = readFileSync(new URL(`./fixtures/${sample.file}`, import.meta.url), 'utf8')
  const source = { name: sample.name, size: Buffer.byteLength(raw) }
  return { id: String(index), source, state: { status: 'result', result: analyzeAnc(raw, source) } }
})
async function reopen(workbook: ExcelJS.Workbook) {
  const saved = await workbook.xlsx.writeBuffer()
  const restored = new ExcelJS.Workbook()
  await restored.xlsx.load(saved)
  return restored.worksheets[0]
}

describe('Excel report saved-file behavior', () => {
  it('exports reference and recommended weights, selected order and exact geometry values together', async () => {
    const sample = entries.find(entry => entry.state.status === 'result' && entry.state.result.status === 'calculated')!
    const second = { ...sample, id: 'reference', source: { ...sample.source, name: 'reference.anc' } }
    const view = buildBatchView([sample, second], defaultMetricIds, defaultSort, {
      material: { referenceDensity: 0.7, volumeCm3: 3000, weightG: null }, requirements: { [sample.id]: { min: 600, max: 650 } },
    })
    const sheet = await reopen(createExcelReport(view))
    expect(sheet.pageSetup.printArea).toBe('A1:D3')
    expect(sheet.getRow(1).values).toEqual([undefined, text.fileName, `${text.retainedVolume} cm³`, `${text.materialWeight} g`, `${text.batWeight} g`])
    for (const [i, row] of view.rows.entries()) {
      const recommended = row.id === sample.id
      expect(sheet.getCell(i + 2, 4).value).toBe(recommended ? row.cells.batWeight.display : row.cells.batWeight.value)
      expect(sheet.getCell(i + 2, 3).value).toBe(recommended ? row.cells.materialWeight.display : row.cells.materialWeight.value)
      expect(sheet.getCell(i + 2, 4).numFmt).toBe('#,##0')
      expect(sheet.getCell(i + 2, 3).numFmt).toBe('#,##0')
      expect(sheet.getCell(i + 2, 3).alignment.wrapText).toBe(true)
      expect(sheet.getCell(i + 2, 2).value).toBe(row.cells.volume.value)
    }
  })
  it('preserves A4 portrait pagination, repeated headers, print area and every supplied file after saving', async () => {
    const view = buildBatchView(entries, allMetricIds, defaultSort)
    const sheet = await reopen(createExcelReport(view))
    expect(sheet.pageSetup).toMatchObject({ paperSize: 9, orientation: 'portrait', fitToPage: true,
      fitToWidth: 1, fitToHeight: 0, horizontalCentered: true, printTitlesRow: '1:1', printArea: 'A1:E44' })
    expect(sheet.rowCount).toBe(44)
    const frozen = sheet.views[0]
    if (frozen.state !== 'frozen') throw new Error('Expected frozen headings')
    expect(frozen.ySplit).toBe(1)
    expect(sheet.getCell('A1').value).toBe(text.fileName)
    expect(sheet.getCell('B1').value).toBe(`${text.retainedVolume} ${text.volumeUnit}`)
    const totalBodyHeight = view.rows.reduce((sum, _, index) => sum + sheet.getRow(2 + index).height!, 0)
    expect(totalBodyHeight).toBeGreaterThan(842)
    for (const [index, item] of view.rows.entries()) {
      expect(sheet.getCell(index + 2, 1).text).toBe(item.name + (item.status.detail ? '\n' + item.status.detail : ''))
      view.columns.forEach((column, position) => {
        const cell = sheet.getCell(index + 2, position + 2)
        expect(cell.value).toBe(item.cells[column.id].value ?? text.missingValue)
        expect(cell.numFmt).toBe(column.numberFormat)
      })
    }
  })
  it('uses selected columns and full-precision sorting, without replacing missing values with zero', async () => {
    const view = buildBatchView(entries, ['volume', 'gripDiameter'], { key: 'volume', direction: 'desc' })
    const sheet = await reopen(createExcelReport(view))
    expect(sheet.columnCount).toBe(3)
    expect(sheet.pageSetup.printArea).toBe('A1:C44')
    expect(sheet.getCell('B2').value).toBe(view.rows[0].cells.volume.value)
    expect(typeof sheet.getCell('B2').value).toBe('number')
    expect(sheet.getCell('B44').value).toBe(text.missingValue)
    expect(sheet.getCell('A44').text).toContain(view.rows.at(-1)!.status.detail)
  })
  it('supports hiding all metrics and treats filenames beginning with = as literal text', async () => {
    const filename = '=SUM(A1:A2).anc'
    const entry: AnalysisEntry = { ...entries[0], source: { name: filename, size: 1 } }
    const sheet = await reopen(createExcelReport(buildBatchView([entry], [], defaultSort)))
    expect(sheet.getCell('A2').value).toBe(filename)
    expect(sheet.getCell('A2').formula).toBeUndefined()
    expect(sheet.pageSetup.printArea).toBe('A1:A2')
    expect(sheet.getColumn(1).width).toBe(18)
  })
  it('sizes saved columns from displayed content and keeps long names within the print width', async () => {
    const sample = entries.find(entry => entry.state.status === 'result' && entry.state.result.status === 'calculated')!
    const short = { ...sample, source: { ...sample.source, name: 'a.anc' } }
    const long = { ...sample, source: { ...sample.source, name: '長檔名'.repeat(80) + '.anc' } }
    const shortSheet = await reopen(createExcelReport(buildBatchView([short], allMetricIds, defaultSort)))
    const longSheet = await reopen(createExcelReport(buildBatchView([long], allMetricIds, defaultSort)))
    expect(shortSheet.getColumn(1).width).toBeLessThan(longSheet.getColumn(1).width!)
    const width = longSheet.columns.reduce((sum, column) => sum + column.width!, 0)
    expect(width).toBeLessThanOrEqual(88)
    expect(longSheet.getRow(2).height).toBeGreaterThan(shortSheet.getRow(2).height!)
    const result = sample.state.status === 'result' ? sample.state.result : null
    if (result?.status !== 'calculated') throw new Error('Expected calculated fixture')
    const large: AnalysisEntry = { ...short, state: { status: 'result', result: { ...result, volumeCm3: 123456789.12 } } }
    const largeSheet = await reopen(createExcelReport(buildBatchView([large], allMetricIds, defaultSort)))
    expect(largeSheet.getColumn(2).width).toBeGreaterThan(shortSheet.getColumn(2).width!)
    expect(largeSheet.getCell('B2').value).toBe(123456789.12)
  })
})
