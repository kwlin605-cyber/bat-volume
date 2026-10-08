export const excelStyle = {
  font: 'Microsoft JhengHei', bodySize: 10, primarySize: 14,
  maximumFilenameWidth: 60, minimumFilenameWidth: 18, minimumMetricWidth: 7, cellPadding: 1.5, preferredTotalWidth: 88, headerUnitGap: 0.5,
  fonts: {
    filename: { size: 10, weight: 400 }, detail: { size: 10, weight: 400 },
    header: { size: 10, weight: 700 }, primaryHeader: { size: 10, weight: 700 },
    unit: { size: 10, weight: 700 }, value: { size: 10, weight: 400 }, primaryValue: { size: 14, weight: 700 },
  },
  headerRow: 1, lineHeight: 14, rowPadding: 12,
  splitFill: { degree: 90, upperEnd: 0.4999, lowerStart: 0.5001 },
  paperSize: 9, orientation: 'portrait',
  margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
} as const
