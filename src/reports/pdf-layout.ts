import { reportStyle as style } from '../config/report'
import { pdfPageSize, type PdfOrientation } from '../config/pdf'
import type { BatchView } from '../features/batch/view-model'
import { text } from '../i18n/zh-TW'
import { buildReportLayout, reportRowHeight, type ReportRow } from './report-layout'

/** Page breaks change placement only; measurements, units and sort remain canonical. */
export function buildPdfLayout(view: BatchView, orientation: PdfOrientation, measure: (value: string, size: number, weight: number) => number) {
  const size = pdfPageSize(orientation)
  const layout = buildReportLayout(view, measure, size.width)
  if (layout.width > size.width + 0.01) throw new Error(text.reportTooWide)
  const top = style.padding + style.headingHeight
  const bottom = size.height - style.padding
  const capacity = bottom - top
  const pages: ReportRow[][] = [[]]
  let y = top
  function append(item: ReportRow) {
    if (y + item.height > bottom + 0.01 && pages.at(-1)!.length) { pages.push([]); y = top }
    pages.at(-1)!.push({ ...item, y })
    y += item.height
  }
  for (const item of layout.rows) {
    if (item.height <= capacity) { append(item); continue }
    // Very long filenames/diagnostics continue on following pages without truncation.
    const names = [...item.nameLines], details = [...item.detailLines]
    while (names.length || details.length) {
      const nameLines = names.splice(0, Math.floor((capacity - style.rowPadding * 2) / style.filenameLineHeight))
      const remaining = capacity - style.rowPadding * 2 - nameLines.length * style.filenameLineHeight - style.detailGap
      const detailLines = names.length ? [] : details.splice(0, Math.max(0, Math.floor(remaining / style.detailLineHeight)))
      append({ ...item, nameLines, detailLines, height: reportRowHeight(view, item.row, nameLines, detailLines) })
    }
  }
  return { ...size, tableOffsetX: (size.width - layout.width) / 2,
    pages: pages.map(rows => ({ ...layout, height: size.height, rows })) }
}
