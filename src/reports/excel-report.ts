import ExcelJS from 'exceljs'
import { reportCellValue, reportCellNumberFormat, type BatchView } from '../features/batch/view-model'
import { excelStyle as style } from '../config/excel'
import { text } from '../i18n/zh-TW'
import { buildColumnLayout, textUnits, type TextMeasure } from '../features/batch/column-layout'
import { createTextMeasure } from '../lib/measure-text'
import { palette, excelColor } from '../config/theme'

function wrappedLineCount(value: string, width: number, measure: TextMeasure) {
  return value.split('\n').reduce((count, line) => {
    return count + Math.max(1, Math.ceil(measure(line, style.fonts.filename) / Math.max(1, width - style.cellPadding * 2)))
  }, 0)
}

/** A narrow transition keeps both unit backgrounds in one printable cell. */
function splitUnitFill(upperColor: string): ExcelJS.Fill {
  return { type: 'gradient', gradient: 'angle', degree: style.splitFill.degree, stops: [
    { position: 0, color: { argb: excelColor(upperColor) } },
    { position: style.splitFill.upperEnd, color: { argb: excelColor(upperColor) } },
    { position: style.splitFill.lowerStart, color: { argb: excelColor(palette.accent) } },
    { position: 1, color: { argb: excelColor(palette.accent) } },
  ] }
}

export function createExcelReport(view: BatchView, date = new Date(), measure: TextMeasure = (value, font) => textUnits(value) * font.size / style.bodySize) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = text.appName; workbook.created = date; workbook.modified = date
  const sheet = workbook.addWorksheet(text.batchTitle, {
    pageSetup: { paperSize: style.paperSize, orientation: style.orientation, fitToPage: true,
      fitToWidth: 1, fitToHeight: 0, horizontalCentered: true, margins: { ...style.margins },
      showGridLines: false, printTitlesRow: `${style.headerRow}:${style.headerRow}` },
    views: [{ state: 'frozen', ySplit: style.headerRow, showGridLines: false }],
    headerFooter: { oddFooter: text.excelPageFooter },
  })
  const columnCount = view.columns.length + 1
  const { filenameWidth, columns } = buildColumnLayout(view, style, measure, style.preferredTotalWidth)
  sheet.getColumn(1).width = filenameWidth
  columns.forEach(({ width }, index) => { sheet.getColumn(index + 2).width = width })
  const header = sheet.getRow(style.headerRow)
  header.values = [text.fileName, ...view.columns.map(column => `${column.label} ${column.unit}`)]
  header.height = 36
  header.eachCell((cell, index) => {
    const prominent = index > 1 && view.columns[index - 2].prominent
    cell.font = { name: style.font, size: style.bodySize, bold: true, color: { argb: excelColor(palette.text) } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: excelColor(prominent ? palette.emphasisAlt : palette.header) } }
    cell.alignment = { horizontal: index === 1 ? 'left' : 'right', vertical: 'middle', wrapText: false }
  })
  view.rows.forEach((item, index) => {
    const row = sheet.getRow(style.headerRow + index + 1)
    const name = row.getCell(1)
    name.value = item.status.detail ? { richText: [{ text: item.name }, { text: '\n' + item.status.detail, font: { color: { argb: excelColor(palette.muted) } } }] } : item.name
    const lines = wrappedLineCount(item.name, filenameWidth, measure) + (item.status.detail ? wrappedLineCount(item.status.detail, filenameWidth, measure) : 0)
    const metricLines = Math.max(1, ...view.columns.map(column => String(reportCellValue(item.cells[column.id], column)).split('\n').length))
    row.height = Math.max(32, (Math.max(lines, metricLines) + 1) * style.lineHeight + style.rowPadding)
    name.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
    view.columns.forEach((column, position) => {
      const cell = row.getCell(position + 2)
      const value = item.cells[column.id]
      const splitUnits = column.splitUnits && !!value.secondary
      const separator = '\n'.repeat(splitUnits ? Math.max(2, Math.round(row.height! / (2 * style.lineHeight))) : 1)
      cell.value = value.secondary ? { richText: [
        { text: value.display, font: { name: style.font, size: column.prominent ? style.primarySize : style.bodySize, bold: column.prominent, color: { argb: excelColor(column.prominent ? palette.ink : palette.text) } } },
        { text: separator + value.secondary, font: { name: style.font, size: style.bodySize, bold: false, color: { argb: excelColor(splitUnits ? palette.white : palette.muted) } } },
      ] } : reportCellValue(value, column)
      cell.numFmt = reportCellNumberFormat(value, column)
      cell.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true }
    })
    for (let position = 1; position <= columnCount; position++) {
      const cell = row.getCell(position)
      const column = position > 1 ? view.columns[position - 2] : undefined
      const prominent = column?.prominent
      const splitUnits = column?.splitUnits && !!item.cells[column.id].secondary
      cell.font = { name: style.font, size: prominent ? style.primarySize : style.bodySize, bold: prominent,
        color: { argb: excelColor(prominent ? palette.ink : palette.text) } }
      const background = prominent ? (index % 2 ? palette.emphasisAlt : palette.emphasis) : (index % 2 ? palette.surface : palette.white)
      cell.fill = splitUnits ? splitUnitFill(background)
        : { type: 'pattern', pattern: 'solid', fgColor: { argb: excelColor(background) } }
      cell.border = { bottom: { style: 'hair', color: { argb: excelColor(palette.line) } } }
    }
  })
  const lastColumn = sheet.getColumn(columnCount).letter
  sheet.pageSetup.printArea = `A1:${lastColumn}${style.headerRow + view.rows.length}`
  return workbook
}

export async function renderExcelReport(view: BatchView, signal: AbortSignal): Promise<Blob> {
  signal.throwIfAborted()
  await document.fonts.ready
  signal.throwIfAborted()
  const measure = createTextMeasure(`"${style.font}"`, 96 / 72, 7)
  const workbook = createExcelReport(view, new Date(), measure)
  const data = await workbook.xlsx.writeBuffer()
  signal.throwIfAborted()
  return new Blob([new Uint8Array(data)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
