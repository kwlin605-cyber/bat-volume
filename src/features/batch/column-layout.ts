import type { BatchView } from './view-model'
import { text } from '../../i18n/zh-TW'

export interface TextStyle { size: number; weight: number; letterSpacing?: number; tabular?: boolean }
export type TextMeasure = (value: string, font: TextStyle) => number
export interface ColumnLayoutStyle {
  minimumFilenameWidth: number; maximumFilenameWidth: number; minimumMetricWidth: number; cellPadding: number; headerUnitGap: number
  minimumEditableWidth?: number
  fonts: { filename: TextStyle; detail: TextStyle; header: TextStyle; primaryHeader: TextStyle;
    unit: TextStyle; value: TextStyle; primaryValue: TextStyle }
}

/** Measure displayed content once per column; only the filename column may wrap. */
export function buildColumnLayout(view: BatchView, style: ColumnLayoutStyle, measure: TextMeasure, availableWidth = Infinity) {
  const lineWidth = (value: string, font: TextStyle) => Math.max(0, ...value.split('\n').map(line => measure(line, font)))
  const padding = style.cellPadding * 2
  let filenameContent = lineWidth(text.fileName, style.fonts.header)
  for (const row of view.rows) {
    filenameContent = Math.max(filenameContent, lineWidth(row.name, style.fonts.filename),
      lineWidth(row.status.detail, style.fonts.detail), row.pending ? lineWidth(text.loading, style.fonts.detail) : 0)
  }
  const columns = view.columns.map(column => {
    const headerFont = column.prominent ? style.fonts.primaryHeader : style.fonts.header
    const valueFont = column.prominent ? style.fonts.primaryValue : style.fonts.value
    let contentWidth = lineWidth(column.label, headerFont) + (column.unit ? style.headerUnitGap + lineWidth(column.unit, style.fonts.unit) : 0)
    for (const row of view.rows) contentWidth = Math.max(contentWidth, lineWidth(row.cells[column.id].display, valueFont), lineWidth(row.cells[column.id].caption ?? '', style.fonts.detail), lineWidth(row.cells[column.id].secondary ?? '', style.fonts.detail))
    return { column, width: Math.max(style.minimumMetricWidth, column.editable ? (style.minimumEditableWidth ?? 0) : 0, Math.ceil(contentWidth + padding)) }
  })
  const metricWidth = columns.reduce((sum, column) => sum + column.width, 0)
  const filenameWidth = Math.max(style.minimumFilenameWidth,
    Math.min(style.maximumFilenameWidth, Math.ceil(filenameContent + padding), availableWidth - metricWidth))
  return { filenameWidth, columns, width: filenameWidth + metricWidth }
}

/** Font-independent fallback for server-side exports and the first browser render. */
export function textUnits(value: string) {
  return [...value].reduce((sum, character) => sum + (/[^\u0000-\u00ff]/.test(character) ? 2 : 1), 0)
}
