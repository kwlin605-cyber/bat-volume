import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, Download, LoaderCircle, SlidersHorizontal, Settings2 } from 'lucide-react'
import type { AnalysisEntry } from '../../services/analysis-state'
import { text } from '../../i18n/zh-TW'
import { renderPngReport } from '../../reports/png-report'
import { downloadReport } from '../../reports/download'
import { allMetricIds, defaultMetricIds, metricColumns, type MetricId } from './columns'
import { buildBatchView, defaultSort, type BatchSort } from './view-model'
import { ResultDialog } from './result-dialog'
import { useColumnLayout } from './use-column-layout'
import { useMaterialSettings } from './use-material-settings'
import { MaterialDialog } from './material-dialog'
import { WeightEditor } from './weight-editor'
import type { WeightRange } from '../../domain/weight'
import { inputWeightUnit } from '../../domain/weight-unit'
import { useWeightUnit } from './use-weight-unit'
import { WeightUnitSelector } from './weight-unit-selector'
import { useDismissibleMenus } from './use-dismissible-menus'
import './batch.css'

export default function BatchResults({ entries }: { entries: AnalysisEntry[] }) {
  const [visible, setVisible] = useState<MetricId[]>(defaultMetricIds)
  const { material, applyMaterial, storageUnavailable } = useMaterialSettings()
  const { mode: weightUnit, selectMode, storageUnavailable: unitStorageUnavailable } = useWeightUnit()
  const [materialOpen, setMaterialOpen] = useState(false)
  const [requirements, setRequirements] = useState<Record<string, WeightRange>>({})
  const [editing, setEditing] = useState<string | null>(null)
  const [sort, setSort] = useState<BatchSort>(defaultSort)
  const [selected, setSelected] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const activeReport = useRef<AbortController | null>(null)
  const downloadMenu = useRef<HTMLDetailsElement | null>(null)
  const sortMenu = useRef<HTMLDetailsElement | null>(null)
  const toolbar = useRef<HTMLDivElement | null>(null)
  useDismissibleMenus(toolbar)
  const selectionKey = entries[0]?.id
  useEffect(() => {
    setExporting(false); setError(''); setSelected(null); setRequirements({}); setEditing(null)
    return () => activeReport.current?.abort()
  }, [selectionKey])
  const view = useMemo(() => buildBatchView(entries, visible, sort, { material, requirements, weightUnit }), [entries, visible, sort, material, requirements, weightUnit])
  const { areaRef, layout } = useColumnLayout(view)
  const selectedEntry = entries.find(entry => entry.id === selected)
  function beginEditing(id: string) {
    if (editing === id) return
    setVisible(current => current.includes('batWeight') ? current : [...current, 'batWeight'])
    setEditing(id)
  }
  function commitRequirement(id: string, range: WeightRange | null) {
    setRequirements(current => { const next = { ...current }; if (range) next[id] = range; else delete next[id]; return next })
    setEditing(null)
  }
  async function exportReport(format: 'png' | 'xlsx') {
    if (exporting || view.summary.pending) return
    if (downloadMenu.current) downloadMenu.current.open = false
    const controller = new AbortController()
    activeReport.current = controller
    setExporting(true); setError('')
    try {
      const blob = format === 'png' ? await renderPngReport(view, controller.signal)
        : await (await import('../../reports/excel-report')).renderExcelReport(view, controller.signal)
      if (!controller.signal.aborted) downloadReport(blob, format)
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error && reason.message === text.reportTooLarge ? text.reportTooLarge : text.reportFailed)
    } finally { if (!controller.signal.aborted) setExporting(false) }
  }
  const { summary } = view
  return <section className="batch-results" aria-labelledby="batch-title">
    <div className="batch-heading"><div><h1 id="batch-title">{text.resultsTitle}</h1><p className="batch-summary" aria-live="polite"><strong>{summary.total}</strong> {text.filesUnit}<span>·</span>{text.completedCount} {summary.calculated}{summary.failed > 0 && <><span>·</span><em>{text.failedCount} {summary.failed}</em></>}{summary.pending > 0 && <><span>·</span>{text.processingCount} {summary.pending}</>}</p></div>
      <div className="batch-tools" ref={toolbar}>
        <button type="button" className="material-settings-button" onClick={() => { setEditing(null); setMaterialOpen(true) }}><Settings2 size={15} />{text.materialSettings}</button>
        <details className="column-menu"><summary><SlidersHorizontal size={15} />{text.visibleInformation}<ChevronDown size={13} /></summary><div className="column-popover"><WeightUnitSelector value={weightUnit} onChange={mode => { setEditing(null); selectMode(mode) }} /><button type="button" onClick={() => setVisible([...allMetricIds])}>{text.selectAllInformation}</button>{metricColumns.map(column => <label key={column.id}><input type="checkbox" checked={visible.includes(column.id)} onChange={event => { if (column.id === 'batWeight') setEditing(null); setVisible(current => event.target.checked ? [...current, column.id] : current.filter(id => id !== column.id)) }} />{column.label}</label>)}</div></details>
        <div className="batch-sort">
          <button className="sort-direction" type="button" aria-label={sort.direction === 'asc' ? text.sortAscending : text.sortDescending} onClick={() => setSort(current => ({ ...current, direction: current.direction === 'asc' ? 'desc' : 'asc' }))}>
            {view.sortLabel}{sort.direction === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
          </button>
          <details className="sort-menu" ref={sortMenu}>
            <summary aria-label={text.sortBy} title={text.sortBy}><ChevronDown size={13} /></summary>
            <div className="sort-popover">{[{ id: 'name' as const, label: text.fileName }, ...metricColumns].map(column => <button key={column.id} type="button" aria-pressed={sort.key === column.id} onClick={() => { setSort(current => ({ ...current, key: column.id })); if (sortMenu.current) sortMenu.current.open = false }}>{column.label}</button>)}</div>
          </details>
        </div>
        <details className="download-menu" ref={downloadMenu}><summary aria-disabled={summary.pending > 0 || exporting} onClick={event => { if (summary.pending > 0 || exporting) event.preventDefault() }}>{exporting ? <LoaderCircle className="spin" size={15} /> : <Download size={15} />}{exporting ? text.preparingReport : text.downloadReport}<ChevronDown size={13} /></summary><div className="download-popover"><button type="button" disabled={summary.pending > 0 || exporting} onClick={() => void exportReport('xlsx')}>{text.excelDownload}</button><button type="button" disabled={summary.pending > 0 || exporting} onClick={() => void exportReport('png')}>{text.pngDownload}</button></div></details>
      </div>
    </div>
    {error && <p className="report-error" role="alert">{error}</p>}
    {(storageUnavailable || unitStorageUnavailable) && <p className="report-error" role="alert">{text.storageUnavailable}</p>}
    <div className="batch-table-area" ref={areaRef}><div className="batch-table-wrap" style={{ width: layout.width + 2 }}>
      <table className="batch-table" style={{ width: layout.width }}>
        <colgroup><col style={{ width: layout.filenameWidth }} />{layout.columns.map(({ column, width }) => <col key={column.id} style={{ width }} />)}</colgroup>
        <thead><tr><th scope="col">{text.fileName}</th>{view.columns.map(column => <th scope="col" className={`numeric ${column.prominent ? 'metric-primary' : ''}`} key={column.id}>{column.label}<small>{column.unit}</small></th>)}</tr></thead>
        <tbody>{view.rows.map(row => <tr key={row.id} data-row-id={row.id} className={editing === row.id ? 'row-editing' : ''} tabIndex={row.pending ? -1 : 0} aria-label={`${text.editRequirement} ${row.name}`}
          onClick={event => { if (!row.pending && !(event.target instanceof Element && event.target.closest('button, input'))) beginEditing(row.id) }}
          onKeyDown={event => { if (event.target === event.currentTarget && !row.pending && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); beginEditing(row.id) } }}>
          <td><button type="button" className="filename-button" disabled={row.pending} aria-label={`${text.previewFile} ${row.name}`} onClick={() => setSelected(row.id)}>{row.name}</button>
            {row.pending && <span className="row-loading"><LoaderCircle size={12} className="spin" aria-hidden="true" />{text.loading}</span>}
            {row.status.detail && <span className="row-diagnostic">{row.status.detail}</span>}
          </td>
          {view.columns.map(column => <td className={`numeric ${column.prominent ? 'metric-primary' : ''}`} key={column.id}>
            {column.id === 'batWeight' ? editing === row.id
              ? <WeightEditor key={row.id} unit={inputWeightUnit(weightUnit)} value={requirements[row.id] ?? null} onCommit={range => commitRequirement(row.id, range)} onCancel={() => setEditing(null)} />
              : <button type="button" className="requirement-trigger" disabled={row.pending} aria-label={`${text.editRequirement} ${row.name}`} onClick={() => beginEditing(row.id)}><span>{row.cells[column.id].display}</span>{row.cells[column.id].secondary && <small className="weight-secondary">{row.cells[column.id].secondary}</small>}</button>
              : <>{row.cells[column.id].display}{row.cells[column.id].secondary && <small className="weight-secondary">{row.cells[column.id].secondary}</small>}{row.cells[column.id].caption && <small className="weight-caption">{row.cells[column.id].caption}</small>}</>}
          </td>)}
        </tr>)}</tbody>
      </table>
    </div></div>
    {selectedEntry && <ResultDialog key={selectedEntry.id} entry={selectedEntry} onDismiss={() => setSelected(null)} />}
    {materialOpen && <MaterialDialog value={material} unit={inputWeightUnit(weightUnit)} onApply={applyMaterial} onDismiss={() => setMaterialOpen(false)} />}
  </section>
}
