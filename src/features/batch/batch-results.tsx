import { useEffect, useMemo, useRef, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import type { AnalysisEntry } from '../../services/analysis-state'
import { text } from '../../i18n/zh-TW'
import { renderPngReport } from '../../reports/png-report'
import { downloadReport } from '../../reports/download'
import type { BatchDisplaySettings } from '../../domain/batch-display'
import { buildBatchView } from './view-model'
import { ResultDialog } from './result-dialog'
import { useColumnLayout } from './use-column-layout'
import { useMaterialSettings } from './use-material-settings'
import { MaterialDialog } from './material-dialog'
import { WeightEditor } from './weight-editor'
import type { WeightRange } from '../../domain/weight'
import { useWeightUnit } from './use-weight-unit'
import { useLengthUnit } from './use-length-unit'
import { BatchToolbar } from './batch-toolbar'
import { RemoveFileButton } from '../../components/remove-file-button'
import './batch.css'

export default function BatchResults({ entries, requirements, display, onDisplayChange, removing, onRemove, onRequirementChange }: { entries: AnalysisEntry[]; requirements: Record<string, WeightRange>; display: BatchDisplaySettings; onDisplayChange: (value: BatchDisplaySettings) => void; removing: boolean; onRemove: (id: string) => void; onRequirementChange: (id: string, range: WeightRange | null) => void }) {
  const { visible, sort } = display
  const { material, applyMaterial, storageUnavailable } = useMaterialSettings()
  const { mode: weightUnit, selectMode, storageUnavailable: unitStorageUnavailable } = useWeightUnit()
  const { mode: lengthUnit, selectMode: selectLengthUnit, storageUnavailable: lengthStorageUnavailable } = useLengthUnit()
  const [materialOpen, setMaterialOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const activeReport = useRef<AbortController | null>(null)
  const selectionKey = entries.map(entry => entry.id).join('|')
  useEffect(() => {
    setExporting(false); setError(''); setSelected(null); setEditing(null)
    return () => activeReport.current?.abort()
  }, [selectionKey])
  useEffect(() => { if (removing) { setEditing(null); setSelected(null) } }, [removing])
  const view = useMemo(() => buildBatchView(entries, visible, sort, { material, requirements, weightUnit }, lengthUnit), [entries, visible, sort, material, requirements, weightUnit, lengthUnit])
  const { areaRef, layout } = useColumnLayout(view, removing ? 48 : 0)
  const selectedEntry = entries.find(entry => entry.id === selected)
  function beginEditing(id: string) {
    if (removing) return
    if (editing === id) return
    if (!visible.includes('batWeight')) onDisplayChange({ ...display, visible: [...visible, 'batWeight'] })
    setEditing(id)
  }
  function commitRequirement(id: string, range: WeightRange | null) {
    onRequirementChange(id, range)
    setEditing(null)
  }
  async function exportReport(format: 'png' | 'xlsx') {
    if (exporting || view.summary.pending) return
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
      <BatchToolbar visible={visible} sort={sort} sortLabel={view.sortLabel} weightUnit={weightUnit} lengthUnit={lengthUnit} onLengthUnitChange={selectLengthUnit} pending={summary.pending > 0} exporting={exporting}
        onVisibleChange={columns => { if (!columns.includes('batWeight')) setEditing(null); onDisplayChange({ ...display, visible: columns }) }} onSortChange={next => onDisplayChange({ ...display, sort: next })} onUnitChange={selectMode}
        onMaterialOpen={() => { setEditing(null); setMaterialOpen(true) }} onExport={format => void exportReport(format)} />
    </div>
    {error && <p className="report-error" role="alert">{error}</p>}
    {(storageUnavailable || unitStorageUnavailable || lengthStorageUnavailable) && <p className="report-error" role="alert">{text.storageUnavailable}</p>}
    <div className={`batch-table-area ${removing ? 'is-removing' : ''}`} ref={areaRef}><div className="batch-table-wrap" style={{ width: layout.width + 2 + (removing ? 48 : 0) }}>
      <table className="batch-table" style={{ width: layout.width + (removing ? 48 : 0) }}>
        <colgroup><col style={{ width: layout.filenameWidth }} />{layout.columns.map(({ column, width }) => <col key={column.id} style={{ width }} />)}{removing && <col style={{ width: 48 }} />}</colgroup>
        <thead><tr><th scope="col">{text.fileName}</th>{view.columns.map(column => <th scope="col" className={`numeric ${column.prominent ? 'metric-primary' : ''}`} key={column.id}>{column.label}<small>{column.unit}</small></th>)}{removing && <th className="remove-cell" scope="col"><span className="sr-only">{text.removeFiles}</span></th>}</tr></thead>
        <tbody>{view.rows.map(row => <tr key={row.id} data-row-id={row.id} className={editing === row.id ? 'row-editing' : ''} tabIndex={row.pending || removing ? -1 : 0} aria-label={`${text.editRequirement} ${row.name}`}
          onClick={event => { if (!row.pending && !(event.target instanceof Element && event.target.closest('button, input'))) beginEditing(row.id) }}
          onKeyDown={event => { if (event.target === event.currentTarget && !row.pending && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); beginEditing(row.id) } }}>
          <td><button type="button" className="filename-button" disabled={row.pending} aria-label={`${text.previewFile} ${row.name}`} onClick={() => setSelected(row.id)}>{row.name}</button>
            {row.pending && <span className="row-loading"><LoaderCircle size={12} className="spin" aria-hidden="true" />{text.loading}</span>}
            {row.status.detail && <span className="row-diagnostic">{row.status.detail}</span>}
          </td>
          {view.columns.map(column => <td className={`numeric ${column.prominent ? 'metric-primary' : ''}`} key={column.id}>
            {column.id === 'batWeight' ? editing === row.id
              ? <WeightEditor key={row.id} value={requirements[row.id] ?? null} onCommit={range => commitRequirement(row.id, range)} onCancel={() => setEditing(null)} />
              : <button type="button" className="requirement-trigger" disabled={row.pending || removing} aria-label={`${text.editRequirement} ${row.name}`} onClick={() => beginEditing(row.id)}><span>{row.cells[column.id].display}</span>{row.cells[column.id].secondary && <small className="weight-secondary">{row.cells[column.id].secondary}</small>}</button>
              : <>{row.cells[column.id].display}{row.cells[column.id].secondary && <small className="weight-secondary">{row.cells[column.id].secondary}</small>}{row.cells[column.id].caption && <small className="weight-caption">{row.cells[column.id].caption}</small>}</>}
          </td>)}
          {removing && <td className="remove-cell"><RemoveFileButton name={row.name} onRemove={() => onRemove(row.id)} /></td>}
        </tr>)}</tbody>
      </table>
    </div></div>
    {selectedEntry && <ResultDialog key={selectedEntry.id} entry={selectedEntry} onDismiss={() => setSelected(null)} />}
    {materialOpen && <MaterialDialog value={material} onApply={applyMaterial} onDismiss={() => setMaterialOpen(false)} />}
  </section>
}
