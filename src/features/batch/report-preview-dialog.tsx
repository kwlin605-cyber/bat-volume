import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, LoaderCircle, Minus, Plus, X } from 'lucide-react'
import type { BatchView } from './view-model'
import { printScaleSettings, validPrintScale } from '../../config/report'
import { createPrintPreview } from '../../reports/print-preview'
import { defaultPrintOptions } from '../../reports/print-options'
import { createReportMeasure, renderReportPage } from '../../reports/report-rendering'
import { reportFormats, type ReportFormat } from '../../reports/formats'
import { downloadReport } from '../../reports/download'
import { text } from '../../i18n/zh-TW'

interface Props { view: BatchView; format: ReportFormat; onDismiss: () => void }
export default function ReportPreviewDialog({ view, format, onDismiss }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const exportController = useRef<AbortController | null>(null)
  const [measure, setMeasure] = useState<ReturnType<typeof createReportMeasure> | null>(null)
  const [separateGroups, setSeparateGroups] = useState(defaultPrintOptions.separateGroups)
  const [scaleMode, setScaleMode] = useState<'manual' | 'onePage' | 'maximum'>(defaultPrintOptions.fitOnePage ? 'onePage' : 'manual')
  const fitOnePage = scaleMode === 'onePage'
  const automatic = scaleMode !== 'manual'
  const [manualPercent, setManualPercent] = useState<number>(printScaleSettings.initial)
  const [groupPercents, setGroupPercents] = useState<number[]>([])
  const [draft, setDraft] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const orientation = format === 'pdf-landscape' ? 'landscape' : 'portrait'
  const isExcel = format === 'xlsx'
  const session = useMemo(() => measure ? createPrintPreview(view, orientation, measure, separateGroups) : null, [view, orientation, measure, separateGroups])
  const validDraft = draft === null || (draft.trim() !== '' && validPrintScale(Number(draft)))
  useEffect(() => {
    dialog.current?.showModal()
    const controller = new AbortController()
    void document.fonts.ready.then(() => {
      if (controller.signal.aborted) return
      try { const next = createReportMeasure(); setMeasure(() => next) }
      catch { setError(text.reportFailed) }
    })
    return () => { controller.abort(); exportController.current?.abort() }
  }, [view, orientation])
  const layout = useMemo(() => session ? (scaleMode === 'onePage' ? session.onePageLayout : scaleMode === 'maximum' ? session.maximumLayout : session.layoutAt(separateGroups ? groupPercents : manualPercent)) : null, [session, scaleMode, separateGroups, groupPercents, manualPercent])
  const currentPage = Math.min(page, (layout?.pages.length ?? 1) - 1)
  const percent = layout?.pages[currentPage].percent ?? manualPercent
  const group = session?.groups[layout?.pages[currentPage].sectionIndex ?? 0]?.group
  const scaleLabel = separateGroups && group ? (group === 'softball' ? text.softball : group === 'baseball' ? text.baseball : text.unclassified) : text.printScale
  useEffect(() => {
    if (!canvas.current || !layout || layout.widthOverflow) return
    const controller = new AbortController()
    try { renderReportPage(canvas.current, layout, currentPage, 2, controller.signal) }
    catch { setError(text.reportFailed) }
    return () => controller.abort()
  }, [layout, currentPage])
  function selectScale(next: number) {
    if (!validPrintScale(next) || !session || !layout) return
    const resized = session.resizePage(layout, currentPage, next)
    if (separateGroups) setGroupPercents(resized.percentages)
    else setManualPercent(next)
    setScaleMode('manual'); setDraft(null); setPage(resized.page); setError('')
  }
  function toggleFit() {
    if (!session) return
    if (!fitOnePage && session.onePageLayout === null) { setError(text.onePageUnavailable.replace('{scale}', String(printScaleSettings.minimum))); return }
    setScaleMode(fitOnePage ? 'manual' : 'onePage'); setDraft(null); setPage(0); setError('')
  }
  function toggleGroups() {
    const next = !separateGroups
    const nextSession = measure ? createPrintPreview(view, orientation, measure, next) : null
    if (next) setGroupPercents(nextSession?.groups.map(() => percent) ?? [])
    else setManualPercent(percent)
    if (automatic && nextSession && (fitOnePage ? nextSession.onePageLayout : nextSession.maximumLayout) === null) {
      setScaleMode('manual'); setError(fitOnePage ? text.onePageUnavailable.replace('{scale}', String(printScaleSettings.minimum)) : text.previewTooWide)
    } else setError('')
    setSeparateGroups(next); setDraft(null); setPage(0)
  }
  async function download() {
    if (!layout || layout.widthOverflow || !validDraft || exporting) return
    const controller = new AbortController()
    exportController.current = controller
    setExporting(true); setError('')
    try {
      const blob = isExcel
        ? await (await import('../../reports/excel-report')).renderExcelReport(view, controller.signal, layout)
        : await (await import('../../reports/pdf-report')).renderPreparedPdf(layout, controller.signal)
      if (!controller.signal.aborted) downloadReport(blob, format)
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error && reason.message === text.reportTooWide ? text.reportTooWide : text.reportFailed)
    } finally { if (!controller.signal.aborted) setExporting(false) }
  }
  return <dialog ref={dialog} className="report-preview-dialog" aria-labelledby="report-preview-title" onClose={onDismiss} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }}>
    <div className="dialog-heading"><div><h2 id="report-preview-title">{text.reportPreview}</h2><p className="report-preview-format">{reportFormats.find(item => item.id === format)!.label}</p></div><button type="button" className="icon-button" aria-label={text.closePreview} onClick={() => dialog.current?.close()}><X size={20} /></button></div>
    <div className="report-preview-controls">
      <button className="print-fit-button" type="button" aria-pressed={separateGroups} disabled={!session || exporting} onClick={toggleGroups}>{text.separateBatGroups}</button>
      <button className="print-fit-button" type="button" aria-pressed={fitOnePage} disabled={!session || exporting} onClick={toggleFit}>{text.fitOnePage}</button>
      <label htmlFor="report-print-scale">{scaleLabel}</label>
      <div className="print-scale-control">
        <button type="button" aria-label={text.reducePrintScale} disabled={exporting || percent <= printScaleSettings.minimum} onClick={() => selectScale(Math.max(printScaleSettings.minimum, percent - printScaleSettings.step))}><Minus size={15} /></button>
        <input id="report-print-scale" type="number" min={printScaleSettings.minimum} max={printScaleSettings.maximum} step="1" value={draft ?? String(percent)} disabled={!session || exporting} aria-invalid={!validDraft || undefined}
          onChange={event => { const value = event.target.value; setDraft(value); if (value.trim() && validPrintScale(Number(value))) selectScale(Number(value)) }}
          onBlur={() => setDraft(null)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); setDraft(null) } }} />
        <span>%</span><button type="button" aria-label={text.increasePrintScale} disabled={exporting || percent >= printScaleSettings.maximum} onClick={() => selectScale(Math.min(printScaleSettings.maximum, percent + printScaleSettings.step))}><Plus size={15} /></button>
      </div>
      <button className="print-fit-button" type="button" aria-pressed={scaleMode === 'maximum'} disabled={!session?.maximumLayout || exporting} onClick={() => { setScaleMode('maximum'); setDraft(null); setPage(0); setError('') }}>
        {session?.maximumLayout ? (session.maximumLayout.sections.length > 1 ? text.maximumGroupPrintScale : text.maximumPrintScale).replace('{pages}', String(session.baselinePages)).replace('{scale}', String(session.maximumLayout.percent)) : text.fitPrintScale}
      </button>
    </div>
    {isExcel && <p className="report-preview-note">{text.excelPreviewEstimate}</p>}
    {error && <p className="report-error" role="alert">{error}</p>}
    <div className="report-preview-page" aria-busy={!session || exporting}>
      {!session ? <p role="status"><LoaderCircle className="spin" size={18} />{text.preparingReport}</p> : layout?.widthOverflow ? <p role="alert">{text.previewTooWide}</p> : <canvas ref={canvas} aria-label={text.reportPreviewPage.replace('{page}', String(currentPage + 1))} />}
    </div>
    <div className="report-preview-footer">
      <div className="report-page-navigation"><button className="icon-button" type="button" aria-label={text.previousPage} disabled={currentPage === 0} onClick={() => { setDraft(null); setPage(currentPage - 1) }}><ChevronLeft size={18} /></button>
        <span aria-live="polite">{layout && !layout.widthOverflow ? text.reportPageCount.replace('{page}', String(currentPage + 1)).replace('{pages}', String(layout.pages.length)) : '—'}</span>
        <button className="icon-button" type="button" aria-label={text.nextPage} disabled={!layout || layout.widthOverflow || currentPage + 1 >= layout.pages.length} onClick={() => { setDraft(null); setPage(currentPage + 1) }}><ChevronRight size={18} /></button>
      </div>
      <button type="button" className="report-download-button" disabled={!layout || layout.widthOverflow || !validDraft || exporting} onClick={() => void download()}>{exporting ? <LoaderCircle className="spin" size={16} /> : <Download size={16} />}{exporting ? text.preparingReport : text.download}</button>
    </div>
  </dialog>
}
