export const reportStyle = {
  // Print dimensions and font sizes are in points, independent of screen pixels.
  padding: 28, minimumFilenameWidth: 72, maximumFilenameWidth: 240, minimumMetricWidth: 36, cellPadding: 7,
  filenameLineHeight: 14, detailLineHeight: 12, detailGap: 4,
  rowPadding: 10, minimumRowHeight: 44, headingHeight: 34, headerUnitGap: 3,
  fontFamily: '"Segoe UI", "Microsoft JhengHei", sans-serif',
  fonts: {
    filename: { size: 10, weight: 700 }, detail: { size: 8, weight: 400 },
    header: { size: 9, weight: 500 }, primaryHeader: { size: 9, weight: 600 },
    unit: { size: 7, weight: 400 }, value: { size: 10, weight: 500 }, primaryValue: { size: 12, weight: 600 },
  },
} as const
