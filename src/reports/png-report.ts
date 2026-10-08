import { reportStyle as style } from '../config/report'
import type { BatchView } from '../features/batch/view-model'
import { text } from '../i18n/zh-TW'
import { buildReportLayout, reportScale } from './png-layout'
import { palette } from '../config/theme'
import { metricFonts } from '../features/batch/column-layout'

export async function renderPngReport(view: BatchView, signal: AbortSignal): Promise<Blob> {
  signal.throwIfAborted()
  await document.fonts.ready
  signal.throwIfAborted()
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error(text.reportFailed)
  const layout = buildReportLayout(view, (value, size, weight) => { ctx.font = `${weight} ${size}px ${style.fontFamily}`; return ctx.measureText(value).width })
  const scale = reportScale(layout.width, layout.height)
  canvas.width = Math.floor(layout.width * scale)
  canvas.height = Math.floor(layout.height * scale)
  ctx.scale(scale, scale)
  ctx.fillStyle = palette.white
  ctx.fillRect(0, 0, layout.width, layout.height)
  ctx.textBaseline = 'top'
  const write = (value: string, x: number, y: number, size = 15, color: string = palette.ink, align: CanvasTextAlign = 'left', weight = 400) => {
    ctx.font = `${weight} ${size}px ${style.fontFamily}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(value, x, y)
  }
  ctx.fillStyle = palette.header; ctx.fillRect(style.padding, layout.tableY, layout.width - style.padding * 2, style.headingHeight)
  write(text.fileName, style.padding + style.cellPadding, layout.tableY + (style.headingHeight - style.fonts.header.size) / 2, style.fonts.header.size, palette.text, 'left', style.fonts.header.weight)
  layout.columns.forEach(({ column, x, width }) => {
    if (column.prominent) { ctx.fillStyle = palette.emphasisAlt; ctx.fillRect(x, layout.tableY, width, style.headingHeight) }
    const right = x + width - style.cellPadding
    const headerFont = column.prominent ? style.fonts.primaryHeader : style.fonts.header
    ctx.font = `${style.fonts.unit.weight} ${style.fonts.unit.size}px ${style.fontFamily}`
    const unitWidth = column.unit ? ctx.measureText(column.unit).width + style.headerUnitGap : 0
    const headerY = layout.tableY + (style.headingHeight - headerFont.size) / 2
    write(column.label, right - unitWidth, headerY, headerFont.size, column.prominent ? palette.ink : palette.text, 'right', headerFont.weight)
    write(column.unit, right, headerY + headerFont.size - style.fonts.unit.size, style.fonts.unit.size, palette.muted, 'right', style.fonts.unit.weight)
  })
  for (const [index, item] of layout.rows.entries()) {
    signal.throwIfAborted()
    ctx.fillStyle = index % 2 ? palette.surface : palette.white
    ctx.fillRect(style.padding, item.y, layout.width - style.padding * 2, item.height)
    layout.columns.forEach(({ column, x, width }) => {
      if (column.prominent) { ctx.fillStyle = index % 2 ? palette.emphasisAlt : palette.emphasis; ctx.fillRect(x, item.y, width, item.height) }
    })
    const top = item.y + style.rowPadding
    item.nameLines.forEach((line, i) => write(line, style.padding + style.cellPadding, top + i * style.filenameLineHeight, style.fonts.filename.size, palette.muted, 'left', style.fonts.filename.weight))
    layout.columns.forEach(({ column, x, width }) => {
      const { value: font, secondary: secondaryFont } = metricFonts(column, style)
      const cell = item.row.cells[column.id]
      if (column.splitUnits && cell.secondary) {
        const halfHeight = item.height / 2
        const right = x + width - style.cellPadding
        ctx.fillStyle = palette.accent
        ctx.fillRect(x, item.y + halfHeight, width, halfHeight)
        write(cell.display, right, item.y + (halfHeight - font.size) / 2, font.size, palette.text, 'right', font.weight)
        write(cell.secondary, right, item.y + halfHeight + (halfHeight - secondaryFont.size) / 2, secondaryFont.size, palette.white, 'right', secondaryFont.weight)
        return
      }
      const blockHeight = font.size + (cell.secondary ? style.detailGap + secondaryFont.size : 0) + (cell.caption ? style.detailGap + style.fonts.detail.size : 0)
      const valueY = item.y + (item.height - blockHeight) / 2
      const right = x + width - style.cellPadding
      write(cell.display, right, valueY, font.size, column.prominent ? palette.ink : palette.text, 'right', font.weight)
      if (cell.secondary) write(cell.secondary, right, valueY + font.size + style.detailGap, secondaryFont.size, column.splitUnits ? palette.text : palette.muted, 'right', secondaryFont.weight)
      if (cell.caption) write(cell.caption, right, valueY + font.size + style.detailGap + (cell.secondary ? style.detailGap + secondaryFont.size : 0), style.fonts.detail.size, palette.muted, 'right', style.fonts.detail.weight)
    })
    const detailY = top + item.nameLines.length * style.filenameLineHeight + style.detailGap
    item.detailLines.forEach((line, i) => write(line, style.padding + style.cellPadding, detailY + i * style.detailLineHeight, style.fonts.detail.size, palette.muted, 'left', style.fonts.detail.weight))
    ctx.strokeStyle = palette.line; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(style.padding, item.y + item.height); ctx.lineTo(layout.width - style.padding, item.y + item.height); ctx.stroke()
  }
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error(text.reportFailed)), 'image/png'))
  signal.throwIfAborted()
  return blob
}
