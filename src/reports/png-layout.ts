import { reportStyle as style } from '../config/report'
import { text } from '../i18n/zh-TW'
import type { BatchRow, BatchView } from '../features/batch/view-model'
import { buildColumnLayout, metricFonts } from '../features/batch/column-layout'

export function wrapText(value: string, width: number, measure: (value: string) => number): string[] {
  if (!value) return []
  const lines: string[] = []
  let line = ''
  for (const character of value) {
    if (character === '\n') { lines.push(line); line = ''; continue }
    if (line && measure(line + character) > width) { lines.push(line); line = character }
    else line += character
  }
  if (line) lines.push(line)
  return lines
}
export interface ReportRow { row: BatchRow; y: number; height: number; nameLines: string[]; detailLines: string[] }
export function buildReportLayout(view: BatchView, measure: (value: string, size: number, weight: number) => number) {
  const sizing = buildColumnLayout(view, style, (value, font) => measure(value, font.size, font.weight))
  let columnX = style.padding + sizing.filenameWidth
  const columns = sizing.columns.map(({ column, width }) => {
    const item = { column, x: columnX, width }
    columnX += width
    return item
  })
  const width = columnX + style.padding
  const tableY = style.padding
  let y = tableY + style.headingHeight
  const rows: ReportRow[] = view.rows.map(row => {
    const contentWidth = sizing.filenameWidth - style.cellPadding * 2
    const nameLines = wrapText(row.name, contentWidth, value => measure(value, style.fonts.filename.size, style.fonts.filename.weight))
    const detailLines = wrapText(row.status.detail, contentWidth, value => measure(value, style.fonts.detail.size, style.fonts.detail.weight))
    const detailHeight = detailLines.length ? style.detailGap + detailLines.length * style.detailLineHeight : 0
    const metricHeight = Math.max(0, ...view.columns.map(column => {
      const fonts = metricFonts(column, style)
      if (column.splitUnits && row.cells[column.id].secondary) return 2 * fonts.value.size + style.rowPadding * 2
      return fonts.value.size + (row.cells[column.id].secondary ? style.detailGap + fonts.secondary.size : 0) + (row.cells[column.id].caption ? style.detailGap + style.fonts.detail.size : 0)
    }))
    const height = Math.max(style.minimumRowHeight, Math.max(metricHeight, nameLines.length * style.filenameLineHeight + detailHeight) + style.rowPadding * 2)
    const layout = { row, y, height, nameLines, detailLines }
    y += height
    return layout
  })
  return { width, height: y + style.padding, tableY, rows, columns, filenameWidth: sizing.filenameWidth }
}
export function reportScale(width: number, height: number) {
  if (width > style.maxDimension || height > style.maxDimension || width * height > style.maxPixels) {
    throw new Error(text.reportTooLarge)
  }
  return Math.min(style.preferredScale, style.maxDimension / width, style.maxDimension / height, Math.sqrt(style.maxPixels / (width * height)))
}
