export const batchExecution = { concurrency: 2 } as const
export const batchTableStyle = {
  minimumFilenameWidth: 180, maximumFilenameWidth: 560, minimumMetricWidth: 64, cellPadding: 20,
  minimumEditableWidth: 184, headerUnitGap: 6,
  fonts: {
    filename: { size: 17, weight: 700 }, detail: { size: 12, weight: 400 },
    header: { size: 14, weight: 500 }, primaryHeader: { size: 14, weight: 600 },
    unit: { size: 11, weight: 400 }, value: { size: 17, weight: 500, tabular: true },
    primaryValue: { size: 20, weight: 600, letterSpacing: -0.4, tabular: true },
  },
} as const
