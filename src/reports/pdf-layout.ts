import { pdfPageSize, type PdfOrientation } from '../config/pdf'
import type { BatchView } from '../features/batch/view-model'
import { text } from '../i18n/zh-TW'
import { buildReportLayout, reportRowHeight, sourceTagHeight, type ReportRow } from './report-layout'
import { printSectionStarts, type PrintOptions } from './print-options'

/** Page breaks change placement only; measurements, units and sort remain canonical. */
export function buildPdfLayout(view: BatchView, orientation: PdfOrientation, measure: (value: string, size: number, weight: number) => number, percent = 100, allowWidthOverflow = false, options: Partial<PrintOptions> = {}) {
  const size = pdfPageSize(orientation)
  const layout = buildReportLayout(view, measure, size.width, percent)
  const { style } = layout
  const widthOverflow = layout.width > size.width + 0.01
  if (widthOverflow && !allowWidthOverflow) throw new Error(text.reportTooWide)
  const top = style.padding + style.headingHeight
  const bottom = size.height - style.padding
  const capacity = bottom - top
  const pages: ReportRow[][] = [[]]
  const sectionStarts = printSectionStarts(view, options.separateGroups ?? false)
  const breaks = new Set(sectionStarts.slice(1))
  let y = top
  function append(item: ReportRow) {
    if (y + item.height > bottom + 0.01 && pages.at(-1)!.length) { pages.push([]); y = top }
    pages.at(-1)!.push({ ...item, y })
    y += item.height
  }
  for (const item of layout.rows) {
    if (breaks.has(item.index) && pages.at(-1)!.length) { pages.push([]); y = top }
    if (item.height <= capacity) { append(item); continue }
    // Very long filenames/diagnostics continue on following pages without truncation.
    const names = [...item.nameLines], sources = [...item.sourceLines], details = [...item.detailLines]
    while (names.length || sources.length || details.length) {
      const nameLines = names.splice(0, Math.max(1, Math.floor((capacity - style.rowPadding * 2) / style.filenameLineHeight)))
      let remaining = capacity - style.rowPadding * 2 - nameLines.length * style.filenameLineHeight - style.detailGap
      const sourceLines = names.length ? [] : sources.splice(0, Math.max(0, Math.floor((remaining - (style.sourceTag.paddingY + style.sourceTag.borderWidth) * 2) / style.sourceTag.lineHeight)))
      if (sourceLines.length) remaining -= sourceTagHeight(sourceLines, style) + style.detailGap
      const detailLines = names.length || sources.length ? [] : details.splice(0, Math.max(0, Math.floor(remaining / style.detailLineHeight)))
      append({ ...item, nameLines, sourceLines, sourceInline: false, detailLines, height: reportRowHeight(view, item.row, nameLines, detailLines, style, sourceLines) })
    }
  }
  return { ...size, percent, widthOverflow, sectionStarts, table: layout, sections: [{ table: layout, sectionStarts }], tableOffsetX: (size.width - layout.width) / 2,
    pages: pages.map(rows => {
      // Centre each completed page, including its repeated heading, without changing breaks.
      const contentHeight = style.headingHeight + rows.reduce((sum, row) => sum + row.height, 0)
      const tableY = Math.max(style.padding, (size.height - contentHeight) / 2)
      const offsetY = tableY - style.padding
      const sectionIndex = Math.max(0, sectionStarts.findLastIndex(start => start <= (rows[0]?.index ?? 0)))
      return { ...layout, height: size.height, tableY, sectionIndex, rows: rows.map(row => ({ ...row, y: row.y + offsetY })) }
    }) }
}
export type PrintLayout = ReturnType<typeof buildPdfLayout>
