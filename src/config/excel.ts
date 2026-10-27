import { reportStyle } from './report'

export const excelStyle = {
  font: 'Segoe UI', chineseFont: 'Microsoft JhengHei',
  headerRow: 1, paperSize: 9, orientation: 'portrait' as const,
  splitFill: { degree: 90, upperEnd: 0.4999, lowerStart: 0.5001 },
  margins: { left: reportStyle.padding / 72, right: reportStyle.padding / 72, top: reportStyle.padding / 72, bottom: reportStyle.padding / 72, header: 0, footer: 0.06 },
} as const
