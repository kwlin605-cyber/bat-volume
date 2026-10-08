import { PDFDocument, PrintScaling } from 'pdf-lib'
import type { BatchView } from '../features/batch/view-model'
import { pdfSettings, type PdfOrientation } from '../config/pdf'
import { reportStyle as style } from '../config/report'
import { palette } from '../config/theme'
import { text } from '../i18n/zh-TW'
import { buildPdfLayout } from './pdf-layout'
import { paintReportPage } from './report-canvas'

/** One fixed-size lossless canvas per A4 page avoids giant batch screenshots. */
export async function renderPdfReport(view: BatchView, orientation: PdfOrientation, signal: AbortSignal): Promise<Blob> {
  signal.throwIfAborted()
  await document.fonts.ready
  signal.throwIfAborted()
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error(text.reportFailed)
  const layout = buildPdfLayout(view, orientation, (value, size, weight) => {
    ctx.font = `${weight} ${size}px ${style.fontFamily}`
    return ctx.measureText(value).width
  })
  const pdf = await PDFDocument.create()
  pdf.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None)
  const scale = pdfSettings.pixelsPerPoint
  canvas.width = Math.ceil(layout.width * scale)
  canvas.height = Math.ceil(layout.height * scale)
  try {
    for (const page of layout.pages) {
      signal.throwIfAborted()
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      ctx.fillStyle = palette.white
      ctx.fillRect(0, 0, layout.width, layout.height)
      ctx.save()
      ctx.translate(layout.tableOffsetX, 0)
      paintReportPage(ctx, page, signal)
      ctx.restore()
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error(text.reportFailed)), 'image/png'))
      signal.throwIfAborted()
      const image = await pdf.embedPng(await blob.arrayBuffer())
      pdf.addPage([layout.width, layout.height]).drawImage(image, { x: 0, y: 0, width: layout.width, height: layout.height })
      await new Promise<void>(resolve => window.setTimeout(resolve, 0))
    }
    signal.throwIfAborted()
    const bytes = await pdf.save()
    signal.throwIfAborted()
    return new Blob([new Uint8Array(bytes).buffer], { type: 'application/pdf' })
  } finally { canvas.width = 0; canvas.height = 0 }
}
