import { reportStyle as style } from '../config/report'
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
export interface ReportRow { row: BatchRow; index: number; y: number; height: number; nameLines: string[]; detailLines: string[] }
export type ReportLayout = ReturnType<typeof buildReportLayout>
export function reportRowHeight(view: BatchView, row: BatchRow, nameLines: string[], detailLines: string[]) {
  const detailHeight = detailLines.length ? style.detailGap + detailLines.length * style.detailLineHeight : 0
  const metricHeight = Math.max(0, ...view.columns.map(column => {
    const fonts = metricFonts(column, style)
    const cell = row.cells[column.id]
    if (column.splitUnits && cell.secondary) return 2 * fonts.value.size + style.rowPadding * 2
    return fonts.value.size + (cell.secondary ? style.detailGap + fonts.secondary.size : 0) + (cell.caption ? style.detailGap + style.fonts.detail.size : 0)
  }))
  return Math.max(style.minimumRowHeight, Math.max(metricHeight, nameLines.length * style.filenameLineHeight + detailHeight) + style.rowPadding * 2)
}
export function buildReportLayout(view: BatchView, measure: (value: string, size: number, weight: number) => number, availableWidth = Infinity) {
  const sizing = buildColumnLayout(view, style, (value, font) => measure(value, font.size, font.weight), availableWidth - style.padding * 2)
  let columnX = style.padding + sizing.filenameWidth
  const columns = sizing.columns.map(({ column, width }) => {
    const item = { column, x: columnX, width }
    columnX += width
    return item
  })
  const width = columnX + style.padding
  const tableY = style.padding
  let y = tableY + style.headingHeight
  const rows: ReportRow[] = view.rows.map((row, index) => {
    const contentWidth = sizing.filenameWidth - style.cellPadding * 2
    const nameLines = wrapText(row.name, contentWidth, value => measure(value, style.fonts.filename.size, style.fonts.filename.weight))
    const detailLines = wrapText(row.status.detail, contentWidth, value => measure(value, style.fonts.detail.size, style.fonts.detail.weight))
    const height = reportRowHeight(view, row, nameLines, detailLines)
    const layout = { row, index, y, height, nameLines, detailLines }
    y += height
    return layout
  })
  return { width, height: y + style.padding, tableY, rows, columns, filenameWidth: sizing.filenameWidth }
}
