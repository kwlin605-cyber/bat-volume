import { text } from '../i18n/zh-TW'

export function downloadReport(blob: Blob, extension: 'png' | 'xlsx', date = new Date()) {
  const stamp = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url; link.download = `${text.reportFilePrefix}-${stamp}.${extension}`
  document.body.append(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
