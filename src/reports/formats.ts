import { text } from '../i18n/zh-TW'

/** Adding an output option does not change toolbar layout or calculation logic. */
export const reportFormats = [
  { id: 'xlsx', label: text.excelDownload, extension: 'xlsx', suffix: '' },
  { id: 'pdf-portrait', label: text.pdfPortraitDownload, extension: 'pdf', suffix: text.portraitSuffix },
  { id: 'pdf-landscape', label: text.pdfLandscapeDownload, extension: 'pdf', suffix: text.landscapeSuffix },
] as const
export type ReportFormat = typeof reportFormats[number]['id']
