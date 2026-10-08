import { text } from '../i18n/zh-TW'
import { reportFormats, type ReportFormat } from './formats'

export function downloadReport(blob: Blob, format: ReportFormat, date = new Date()) {
  const { extension, suffix } = reportFormats.find(item => item.id === format)!
  const stamp = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url; link.download = `${text.reportFilePrefix}-${stamp}${suffix}.${extension}`
  document.body.append(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
