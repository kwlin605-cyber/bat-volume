import ExcelJS from 'exceljs'
import { reportCellValue, reportCellNumberFormat, type BatchView } from '../features/batch/view-model'
import { excelStyle } from '../config/excel'
import { text } from '../i18n/zh-TW'
import { textUnits, type TextMeasure } from '../features/batch/column-layout'
import { palette, excelColor } from '../config/theme'
import { buildPdfLayout, type PrintLayout } from './pdf-layout'
import { createReportMeasure } from './report-rendering'
import { displayFileName } from '../lib/file-name'
import { reportView } from './report-view'

/** Excel column units use the Normal-style digit width, independently of each cell's font. */
export const pointsToExcelWidth = (points: number) => Math.max(0, (points * 96 / 72 - 5) / 7)

export function excelTextRuns(value: string, font: Partial<ExcelJS.Font> = {}): ExcelJS.RichText[] {
  return value.split(/([\p{Script=Han}\p{Script=Bopomofo}\u3000-\u303f\uff00-\uffef]+)/u).filter(Boolean).map(part => ({
    text: part, font: { ...font, name: /[\p{Script=Han}\p{Script=Bopomofo}\u3000-\u303f\uff00-\uffef]/u.test(part) ? excelStyle.chineseFont : excelStyle.font },
  }))
}
function textValue(value: string, font: Partial<ExcelJS.Font>): string | ExcelJS.CellRichTextValue {
  const richText = excelTextRuns(value, font)
  return richText.some(run => run.font?.name === excelStyle.chineseFont) ? { richText } : value
}
function splitUnitFill(lowerColor: string): ExcelJS.Fill {
  return { type: 'gradient', gradient: 'angle', degree: excelStyle.splitFill.degree, stops: [
    { position: 0, color: { argb: excelColor(palette.accent) } },
    { position: excelStyle.splitFill.upperEnd, color: { argb: excelColor(palette.accent) } },
    { position: excelStyle.splitFill.lowerStart, color: { argb: excelColor(lowerColor) } },
    { position: 1, color: { argb: excelColor(lowerColor) } },
  ] }
}

export function createExcelReport(view: BatchView, date = new Date(), measure: TextMeasure = (value, font) => textUnits(value) * font.size * 0.5, percent = 100, prepared?: PrintLayout) {
  view = reportView(view, 'xlsx')
  const layout = prepared ?? buildPdfLayout(view, 'portrait', (value, size, weight) => measure(value, { size, weight }), percent)
  if (layout.widthOverflow) throw new Error(text.reportTooWide)
  const workbook = new ExcelJS.Workbook()
  workbook.creator = text.appName; workbook.created = date; workbook.modified = date
  for (const { table, sectionStarts } of layout.sections) {
    const { style } = table
    const group = table.rows[0]?.row.group
    const sheetName = layout.sections.length === 1 ? text.batchTitle : group === 'softball' ? text.softball : text.baseball
    const sheet = workbook.addWorksheet(sheetName, {
      // ExcelJS omits an unstyled column whose width is exactly 9.
      properties: { defaultColWidth: 9 },
      pageSetup: { paperSize: excelStyle.paperSize, orientation: 'portrait', fitToPage: false, scale: 100,
        horizontalCentered: true, verticalCentered: true, margins: { ...excelStyle.margins }, showGridLines: false, printTitlesRow: '1:1' },
      views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
      headerFooter: { oddFooter: `&C&7${text.excelPageFooter.replace('&C', '')}` },
    })
    // Fonts, rows and columns already reflect the selected scale; never shrink again to fit.
    sheet.getColumn(1).width = pointsToExcelWidth(table.filenameWidth)
    table.columns.forEach(({ width }, index) => { sheet.getColumn(index + 2).width = pointsToExcelWidth(width) })
    const header = sheet.getRow(1)
    header.height = style.headingHeight
    const headings = [{ label: text.fileName, unit: '', prominent: false }, ...view.columns]
    headings.forEach((column, index) => {
      const cell = header.getCell(index + 1)
      const headerFont = { size: style.fonts.header.size, bold: true, color: { argb: excelColor(palette.text) } }
      cell.value = { richText: [...excelTextRuns(column.label, headerFont), ...excelTextRuns(column.unit ? ` ${column.unit}` : '', { ...headerFont, size: style.fonts.unit.size })] }
      cell.font = { name: excelStyle.font, ...headerFont }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: excelColor(column.prominent ? palette.emphasisAlt : palette.header) } }
      cell.alignment = { horizontal: index === 0 ? 'left' : 'center', vertical: 'middle', wrapText: false }
    })
    table.rows.forEach((item, index) => {
      const row = sheet.getRow(index + 2)
      row.height = item.height
      const name = row.getCell(1)
      const nameFont = { size: style.fonts.filename.size, bold: true, color: { argb: excelColor(palette.muted) } }
      name.value = item.row.status.detail ? { richText: [...excelTextRuns(displayFileName(item.row.name), nameFont), ...excelTextRuns('\n' + item.row.status.detail, { ...nameFont, size: style.fonts.detail.size, bold: false })] } : textValue(displayFileName(item.row.name), nameFont)
      name.font = { name: excelStyle.font, ...nameFont }
      name.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
      view.columns.forEach((column, position) => {
        const cell = row.getCell(position + 2)
        const value = item.row.cells[column.id]
        const font = { name: excelStyle.font, size: column.prominent ? style.fonts.primaryValue.size : style.fonts.value.size, bold: column.prominent, color: { argb: excelColor(column.prominent ? palette.ink : palette.text) } }
        cell.font = font
        const splitUnits = column.splitUnits && !!value.secondary
        const separator = '\n'.repeat(splitUnits ? Math.max(2, Math.round(item.height / (2 * style.filenameLineHeight))) : 1)
        const output = reportCellValue(value, column)
        cell.value = value.secondary ? { richText: [
          ...excelTextRuns(value.display, splitUnits ? { ...font, color: { argb: excelColor(palette.white) } } : font),
          ...excelTextRuns(separator + value.secondary, { ...font, size: splitUnits ? font.size : style.fonts.detail.size, color: { argb: excelColor(splitUnits ? palette.text : palette.muted) } }),
        ] } : typeof output === 'number' ? output : textValue(output, font)
        cell.numFmt = reportCellNumberFormat(value, column)
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      })
      for (let position = 1; position <= view.columns.length + 1; position++) {
        const cell = row.getCell(position)
        const column = view.columns[position - 2]
        const background = column?.prominent ? (index % 2 ? palette.emphasisAlt : palette.emphasis) : (index % 2 ? palette.surface : palette.white)
        cell.fill = column?.splitUnits && item.row.cells[column.id].secondary ? splitUnitFill(background) : { type: 'pattern', pattern: 'solid', fgColor: { argb: excelColor(background) } }
        cell.border = { bottom: { style: 'hair', color: { argb: excelColor(palette.line) } } }
      }
    })
    // Explicit group boundaries survive saving; automatic breaks within a group remain native.
    for (const start of sectionStarts.slice(1)) sheet.getRow(start + 1).addPageBreak()
    sheet.pageSetup.printArea = `A1:${sheet.getColumn(view.columns.length + 1).letter}${table.rows.length + 1}`
  }
  return workbook
}

export async function renderExcelReport(view: BatchView, signal: AbortSignal, prepared?: PrintLayout): Promise<Blob> {
  signal.throwIfAborted()
  await document.fonts.ready
  signal.throwIfAborted()
  const layout = prepared ?? buildPdfLayout(reportView(view, 'xlsx'), 'portrait', createReportMeasure())
  const workbook = createExcelReport(view, new Date(), undefined, layout.percent, layout)
  const data = await workbook.xlsx.writeBuffer()
  signal.throwIfAborted()
  return new Blob([new Uint8Array(data)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
