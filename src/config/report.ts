import { palette } from './theme'
import { scaledSourceTagStyle } from './source-tag'

export const reportStyle = {
  sourceTag: scaledSourceTagStyle(72 / 96),
  rowLineColor: palette.border,
  // Print dimensions and font sizes are in points, independent of screen pixels.
  padding: 5 * 72 / 25.4, minimumFilenameWidth: 86.4, maximumFilenameWidth: 288, minimumMetricWidth: 43.2, cellPadding: 8.4,
  filenameLineHeight: 16.8, detailLineHeight: 14.4, detailGap: 4.8,
  rowPadding: 12, minimumRowHeight: 52.8, headingHeight: 40.8, headerUnitGap: 3.6,
  fontFamily: '"Segoe UI", "Microsoft JhengHei", sans-serif',
  fonts: {
    filename: { size: 12, weight: 700 }, detail: { size: 9.6, weight: 400 },
    header: { size: 10.8, weight: 500 }, primaryHeader: { size: 10.8, weight: 600 },
    unit: { size: 8.4, weight: 400 }, value: { size: 12, weight: 500 }, primaryValue: { size: 14, weight: 600 },
  },
} as const

export const printScaleSettings = { initial: 100, minimum: 25, maximum: 200, step: 5 } as const
export const validPrintScale = (value: number) => Number.isInteger(value) && value >= printScaleSettings.minimum && value <= printScaleSettings.maximum

/** Scale table dimensions, never paper margins. Both preview and output read this style. */
export function scaledReportStyle(percent = printScaleSettings.initial as number) {
  if (!validPrintScale(percent)) throw new RangeError('Invalid print scale')
  const factor = percent / 100
  return {
    ...reportStyle,
    sourceTag: scaledSourceTagStyle(72 / 96 * factor),
    minimumFilenameWidth: reportStyle.minimumFilenameWidth * factor, maximumFilenameWidth: reportStyle.maximumFilenameWidth * factor,
    minimumMetricWidth: reportStyle.minimumMetricWidth * factor, cellPadding: reportStyle.cellPadding * factor,
    filenameLineHeight: reportStyle.filenameLineHeight * factor, detailLineHeight: reportStyle.detailLineHeight * factor,
    detailGap: reportStyle.detailGap * factor, rowPadding: reportStyle.rowPadding * factor,
    minimumRowHeight: reportStyle.minimumRowHeight * factor, headingHeight: reportStyle.headingHeight * factor,
    headerUnitGap: reportStyle.headerUnitGap * factor,
    fonts: Object.fromEntries(Object.entries(reportStyle.fonts).map(([key, font]) => [key, { ...font, size: font.size * factor }])) as Record<keyof typeof reportStyle.fonts, { size: number; weight: number }>,
  }
}
