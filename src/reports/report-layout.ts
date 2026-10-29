import { scaledReportStyle } from '../config/report'
import { displayFileName } from '../lib/file-name'
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
export interface ReportRow { row: BatchRow; index: number; y: number; height: number; nameLines: string[]; detailLines: string[]; sourceLines: string[]; sourceInline: boolean; sourceOffsetX: number }
export type ReportLayout = ReturnType<typeof buildReportLayout>
export function sourceTagHeight(lines: readonly string[], style = scaledReportStyle()) {
  return lines.length ? lines.length * style.sourceTag.lineHeight + (style.sourceTag.paddingY + style.sourceTag.borderWidth) * 2 : 0
}
export function nameBlockHeight(nameLines: readonly string[], sourceLines: readonly string[], sourceInline: boolean, style = scaledReportStyle()) {
  const names = nameLines.length * style.filenameLineHeight
  const tag = sourceTagHeight(sourceLines, style)
  return sourceInline ? Math.max(names, tag) : names + (tag ? style.detailGap + tag : 0)
}
export function reportRowHeight(view: BatchView, row: BatchRow, nameLines: string[], detailLines: string[], style = scaledReportStyle(), sourceLines: string[] = [], sourceInline = false) {
  const detailHeight = detailLines.length ? style.detailGap + detailLines.length * style.detailLineHeight : 0
  const metricHeight = Math.max(0, ...view.columns.map(column => {
    const fonts = metricFonts(column, style)
    const cell = row.cells[column.id]
    if (column.splitUnits && cell.secondary) return 2 * fonts.value.size + style.rowPadding * 2
    return fonts.value.size + (cell.secondary ? style.detailGap + fonts.secondary.size : 0) + (cell.caption ? style.detailGap + style.fonts.detail.size : 0)
  }))
  return Math.max(style.minimumRowHeight, Math.max(metricHeight, nameBlockHeight(nameLines, sourceLines, sourceInline, style) + detailHeight) + style.rowPadding * 2)
}
export type ReportMeasure = (value: string, size: number, weight: number) => number
export function buildReportLayout(view: BatchView, measure: ReportMeasure, availableWidth = Infinity, percent = 100) {
  const style = scaledReportStyle(percent)
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
    const nameLines = wrapText(displayFileName(row.name), contentWidth, value => measure(value, style.fonts.filename.size, style.fonts.filename.weight))
    const tag = style.sourceTag
    const sourceLines = wrapText(row.sourceLabel ?? '', Math.max(1, contentWidth - (tag.paddingX + tag.borderWidth) * 2), value => measure(value, tag.fontSize, tag.fontWeight))
    const sourceOffsetX = measure(displayFileName(row.name), style.fonts.filename.size, style.fonts.filename.weight) + tag.gap
    const sourceInline = nameLines.length === 1 && sourceLines.length === 1 && sourceOffsetX + measure(sourceLines[0], tag.fontSize, tag.fontWeight) + (tag.paddingX + tag.borderWidth) * 2 <= contentWidth
    const detailLines = wrapText(row.status.detail, contentWidth, value => measure(value, style.fonts.detail.size, style.fonts.detail.weight))
    const height = reportRowHeight(view, row, nameLines, detailLines, style, sourceLines, sourceInline)
    const layout = { row, index, y, height, nameLines, detailLines, sourceLines, sourceInline, sourceOffsetX }
    y += height
    return layout
  })
  return { width, height: y + style.padding, tableY, rows, columns, filenameWidth: sizing.filenameWidth, style, percent }
}
