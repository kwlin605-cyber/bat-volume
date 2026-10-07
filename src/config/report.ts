export const reportStyle = {
  padding: 32, minimumFilenameWidth: 180, maximumFilenameWidth: 560, minimumMetricWidth: 64, cellPadding: 20,
  filenameLineHeight: 26, detailLineHeight: 22, detailGap: 8,
  rowPadding: 18, minimumRowHeight: 76, headingHeight: 64, headerUnitGap: 6,
  fontFamily: '"Segoe UI", "Microsoft JhengHei", sans-serif',
  fonts: {
    filename: { size: 17, weight: 700 }, detail: { size: 14, weight: 400 },
    header: { size: 14, weight: 500 }, primaryHeader: { size: 14, weight: 600 },
    unit: { size: 11, weight: 400 }, value: { size: 18, weight: 500 }, primaryValue: { size: 20, weight: 600 },
  },
  maxDimension: 16384, maxPixels: 32_000_000, preferredScale: 2,
} as const
