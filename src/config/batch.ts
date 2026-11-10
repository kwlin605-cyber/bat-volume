import { sourceTagStyle } from './source-tag'

export const batchExecution = { concurrency: 2 } as const
export const batchTableStyle = {
  sourceTag: sourceTagStyle,
  minimumFilenameWidth: 180, maximumFilenameWidth: 560, minimumMetricWidth: 64, cellPadding: 20,
  minimumEditableWidth: 184, headerUnitGap: 6,
  fonts: {
    filename: { size: 17, weight: 700 }, detail: { size: 12, weight: 400 },
    header: { size: 14, weight: 500 }, primaryHeader: { size: 14, weight: 600 },
    unit: { size: 11, weight: 400 }, value: { size: 17, weight: 500, tabular: true },
    primaryValue: { size: 20, weight: 600, letterSpacing: -0.4, tabular: true },
  },
} as const

export const batchTableCssVariables: Readonly<Record<string, string>> = Object.fromEntries([
  ['--batch-cell-padding', `${batchTableStyle.cellPadding}px`],
  ['--batch-header-unit-gap', `${batchTableStyle.headerUnitGap}px`],
  ...Object.entries(batchTableStyle.fonts).flatMap(([role, font]) => [
    [`--batch-${role}-size`, `${font.size}px`],
    [`--batch-${role}-weight`, String(font.weight)],
    ...('letterSpacing' in font ? [[`--batch-${role}-letter-spacing`, `${font.letterSpacing}px`]] : []),
  ]),
])
