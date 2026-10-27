import { printScaleSettings } from '../config/report'
import type { PdfOrientation } from '../config/pdf'
import type { BatchView } from '../features/batch/view-model'
import type { ReportMeasure } from './report-layout'
import { buildPdfLayout, type PrintLayout } from './pdf-layout'
import { defaultPrintOptions, printSectionStarts } from './print-options'

/** Each dialog owns a fresh session; its 100% baseline never follows the edited scale. */
export function createPrintPreview(view: BatchView, orientation: PdfOrientation, measure: ReportMeasure, separateGroups = defaultPrintOptions.separateGroups) {
  const starts = printSectionStarts(view, separateGroups)
  if (!starts.length) starts.push(0)
  const groups = starts.map((start, index) => {
    const section = { ...view, rows: view.rows.slice(start, starts[index + 1]) }
    return { group: section.rows[0]?.group, layoutAt: (percent: number) => buildPdfLayout(section, orientation, measure, percent, true) }
  })
  function combine(parts: PrintLayout[]): PrintLayout {
    return { ...parts[0], widthOverflow: parts.some(part => part.widthOverflow), sectionStarts: starts,
      sections: parts.flatMap(part => part.sections),
      pages: parts.flatMap((part, sectionIndex) => part.pages.map(page => ({ ...page, sectionIndex }))) }
  }
  const layoutAt = (percent: number | readonly number[]) => combine(groups.map((group, index) => group.layoutAt(typeof percent === 'number' ? percent : percent[index] ?? printScaleSettings.initial)))
  const baseline = layoutAt(printScaleSettings.initial)
  const baselinePages = baseline.pages.length
  // Width and row heights are nondecreasing as scale increases, including filename wrapping.
  function maximumFor(pageLimit: number, candidateAt: (percent: number) => PrintLayout) {
    let low = printScaleSettings.minimum, high = printScaleSettings.maximum, maximum: number | null = null
    while (low <= high) {
      const middle = Math.floor((low + high) / 2)
      const candidate = candidateAt(middle)
      if (!candidate.widthOverflow && candidate.pages.length <= pageLimit) { maximum = middle; low = middle + 1 }
      else high = middle - 1
    }
    return maximum
  }
  function fitSections(onePage: boolean): PrintLayout | null {
    const fitted: PrintLayout[] = []
    for (const [index, group] of groups.entries()) {
      // Keep the page allowance seen at 100%, including continued rows and unknowns.
      const pageLimit = onePage ? 1 : baseline.pages.filter(page => page.sectionIndex === index).length
      const maximum = maximumFor(pageLimit, group.layoutAt)
      if (maximum === null) return null
      fitted.push(group.layoutAt(maximum))
    }
    return combine(fitted)
  }
  /** Begin manual editing from the displayed sizes, preserving every other section. */
  function resizePage(layout: PrintLayout, pageIndex: number, percent: number) {
    const current = layout.pages[pageIndex]
    const percentages = layout.sections.map(section => section.table.percent)
    percentages[current.sectionIndex] = percent
    const resized = layoutAt(percentages)
    const anchor = current.rows[0]?.row.id
    const page = resized.pages.findIndex(candidate => candidate.sectionIndex === current.sectionIndex && (!anchor || candidate.rows.some(item => item.row.id === anchor)))
    return { layout: resized, percentages, page: Math.max(0, page) }
  }
  return { baseline, baselinePages, groups, maximumLayout: fitSections(false), onePageLayout: fitSections(true), onePageCount: starts.length, layoutAt, resizePage }
}
