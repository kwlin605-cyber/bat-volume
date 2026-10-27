import { reportStyle } from '../config/report'
import { palette } from '../config/theme'
import { text } from '../i18n/zh-TW'
import type { PrintLayout } from './pdf-layout'
import type { ReportMeasure } from './report-layout'
import { paintReportPage } from './report-canvas'

export function createReportMeasure(): ReportMeasure {
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) throw new Error(text.reportFailed)
  const cache = new Map<string, number>()
  return (value, size, weight) => {
    const key = JSON.stringify([value, size, weight])
    if (!cache.has(key)) { ctx.font = `${weight} ${size}px ${reportStyle.fontFamily}`; cache.set(key, ctx.measureText(value).width) }
    return cache.get(key)!
  }
}

/** The same page painter drives the dialog canvas and the downloaded PDF image. */
export function renderReportPage(canvas: HTMLCanvasElement, layout: PrintLayout, pageIndex: number, resolution: number, signal: AbortSignal) {
  signal.throwIfAborted()
  if (layout.widthOverflow) throw new Error(text.reportTooWide)
  canvas.width = Math.ceil(layout.width * resolution); canvas.height = Math.ceil(layout.height * resolution)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error(text.reportFailed)
  ctx.setTransform(resolution, 0, 0, resolution, 0, 0)
  ctx.fillStyle = palette.white; ctx.fillRect(0, 0, layout.width, layout.height)
  ctx.save()
  const page = layout.pages[pageIndex]
  try { ctx.translate((layout.width - page.width) / 2, 0); paintReportPage(ctx, page, signal) }
  finally { ctx.restore() }
}
