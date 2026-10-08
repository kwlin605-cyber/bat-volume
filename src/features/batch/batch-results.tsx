import { useEffect, useMemo, useRef, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import type { AnalysisEntry } from '../../services/analysis-state'
import { text } from '../../i18n/zh-TW'
import type { ReportFormat } from '../../reports/formats'
import { downloadReport } from '../../reports/download'
import type { BatchDisplaySettings } from '../../domain/batch-display'
import { buildBatchView } from './view-model'
import { ResultDialog } from './result-dialog'
import { useColumnLayout } from './use-column-layout'
import { useMaterialSettings } from './use-material-settings'
import { MaterialDialog } from './material-dialog'
import { RequirementPopover } from './requirement-popover'
import { useRowSelection } from './use-row-selection'
import { rowSelectionSettings } from '../../config/selection'
import type { WeightRange } from '../../domain/weight'
import { useWeightUnit } from './use-weight-unit'
import { useLengthUnit } from './use-length-unit'
import { useBatGrouping } from './use-bat-grouping'
import { BatchToolbar } from './batch-toolbar'
import { RemoveFileButton } from '../../components/remove-file-button'
import './batch.css'

export default function BatchResults({ entries, requirements, display, onDisplayChange, removing, onRemove, onRequirementChange }: { entries: AnalysisEntry[]; requirements: Record<string, WeightRange>; display: BatchDisplaySettings; onDisplayChange: (value: BatchDisplaySettings) => void; removing: boolean; onRemove: (id: string) => void; onRequirementChange: (ids: readonly string[], range: WeightRange | null) => void }) {
  const { visible, sort } = display
  const { material, applyMaterial, storageUnavailable } = useMaterialSettings()
  const { mode: weightUnit, selectMode, storageUnavailable: unitStorageUnavailable } = useWeightUnit()
  const { mode: lengthUnit, selectMode: selectLengthUnit, storageUnavailable: lengthStorageUnavailable } = useLengthUnit()
  const { grouping, applyGrouping, storageUnavailable: groupingStorageUnavailable } = useBatGrouping()
  const [materialOpen, setMaterialOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const activeReport = useRef<AbortController | null>(null)
  const selectionKey = entries.map(entry => entry.id).join('|')
  useEffect(() => {
    setExporting(false); setError(''); setSelected(null)
    return () => activeReport.current?.abort()
  }, [selectionKey])
  useEffect(() => { if (removing) setSelected(null) }, [removing])
  const view = useMemo(() => buildBatchView(entries, visible, sort, { material, requirements, weightUnit }, lengthUnit, grouping), [entries, visible, sort, material, requirements, weightUnit, lengthUnit, grouping])
  const { areaRef, layout } = useColumnLayout(view, removing ? 48 : 0)
  const selection = useRowSelection(view.rows, removing, areaRef)
  const selectedEntry = entries.find(entry => entry.id === selected)
  function commitRequirement(range: WeightRange | null) {
    if (selection.editing) onRequirementChange(selection.editing.ids, range)
    selection.cancel()
  }
  async function exportReport(format: ReportFormat) {
    if (exporting || view.summary.pending) return
    const controller = new AbortController()
    activeReport.current = controller
    setExporting(true); setError('')
    try {
      const blob = format === 'xlsx'
        ? await (await import('../../reports/excel-report')).renderExcelReport(view, controller.signal)
        : await (await import('../../reports/pdf-report')).renderPdfReport(view, format === 'pdf-portrait' ? 'portrait' : 'landscape', controller.signal)
      if (!controller.signal.aborted) downloadReport(blob, format)
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error && reason.message === text.reportTooWide ? text.reportTooWide : text.reportFailed)
    } finally { if (!controller.signal.aborted) setExporting(false) }
  }
  const { summary } = view
  return <section className="batch-results" aria-labelledby="batch-title" style={{ '--selection-background': rowSelectionSettings.colors.background, '--selection-accent': rowSelectionSettings.colors.accent } as React.CSSProperties}>
    <div className="batch-heading"><div><h1 id="batch-title">{text.resultsTitle}</h1><p className="batch-summary" aria-live="polite"><strong>{summary.total}</strong> {text.filesUnit}<span>·</span>{text.completedCount} {summary.calculated}{summary.failed > 0 && <><span>·</span><em>{text.failedCount} {summary.failed}</em></>}{summary.pending > 0 && <><span>·</span>{text.processingCount} {summary.pending}</>}</p></div>
      <BatchToolbar visible={visible} sort={sort} sortLabel={view.sortLabel} weightUnit={weightUnit} lengthUnit={lengthUnit} onLengthUnitChange={selectLengthUnit} pending={summary.pending > 0} exporting={exporting}
        grouping={grouping} onGroupingChange={next => { selection.cancel(); applyGrouping(next) }}
        onVisibleChange={columns => { selection.cancel(); onDisplayChange({ ...display, visible: columns }) }} onSortChange={next => { selection.cancel(); onDisplayChange({ ...display, sort: next }) }} onUnitChange={selectMode}
        onMaterialOpen={() => { selection.cancel(); setMaterialOpen(true) }} onExport={format => void exportReport(format)} />
    </div>
    {error && <p className="report-error" role="alert">{error}</p>}
    {(storageUnavailable || unitStorageUnavailable || lengthStorageUnavailable || groupingStorageUnavailable) && <p className="report-error" role="alert">{text.storageUnavailable}</p>}
    <div className={`batch-table-area ${removing ? 'is-removing' : ''}`} ref={areaRef}><div className="batch-table-wrap" style={{ width: layout.width + 2 + (removing ? 48 : 0) }}>
      <table className={`batch-table ${selection.dragging ? 'is-selecting' : ''}`} style={{ width: layout.width + (removing ? 48 : 0) }}>
        <colgroup><col style={{ width: layout.filenameWidth }} />{layout.columns.map(({ column, width }) => <col key={column.id} style={{ width }} />)}{removing && <col style={{ width: 48 }} />}</colgroup>
        <thead><tr><th scope="col">{text.fileName}</th>{view.columns.map(column => <th scope="col" className={`numeric ${column.prominent ? 'metric-primary' : ''}`} key={column.id}>{column.label}<small>{column.unit}</small></th>)}{removing && <th className="remove-cell" scope="col"><span className="sr-only">{text.removeFiles}</span></th>}</tr></thead>
        <tbody>{view.rows.map(row => <tr key={row.id} data-row-id={row.id} className={selection.ids.includes(row.id) ? 'row-selected' : ''} tabIndex={row.pending || removing ? -1 : 0} aria-label={`${text.selectBat} ${row.name}`} aria-describedby="row-selection-help"
          onPointerDown={event => selection.pointerDown(event, row.id)}
          onClick={event => { if (!row.pending && !(event.target instanceof Element && event.target.closest('button:not(.requirement-trigger, .filename-button), input'))) selection.select(row.id, event, event.currentTarget) }}
          onKeyDown={event => { if (event.target === event.currentTarget && !row.pending && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); selection.select(row.id, event, event.currentTarget) } }}>
          <td><button type="button" className="filename-button" disabled={row.pending} aria-label={`${text.previewFile} ${row.name}`} onClick={event => { if (event.ctrlKey || event.shiftKey) return; event.stopPropagation(); selection.cancel(); setSelected(row.id) }}>{row.name}</button>
            {row.pending && <span className="row-loading"><LoaderCircle size={12} className="spin" aria-hidden="true" />{text.loading}</span>}
            {row.status.detail && <span className="row-diagnostic">{row.status.detail}</span>}
          </td>
          {view.columns.map(column => <td className={`numeric ${column.prominent ? 'metric-primary' : ''} ${column.splitUnits && row.cells[column.id].secondary ? 'metric-dual-value' : ''}`} key={column.id}>
            {column.id === 'batWeight'
              ? <button type="button" className="requirement-trigger" disabled={row.pending || removing} aria-label={`${text.selectBat} ${row.name}`}><span>{row.cells[column.id].display}</span>{row.cells[column.id].secondary && <small className="weight-secondary">{row.cells[column.id].secondary}</small>}</button>
              : column.splitUnits && row.cells[column.id].secondary
                ? <div className="dual-unit-value"><span>{row.cells[column.id].display}</span><span>{row.cells[column.id].secondary}</span></div>
                : <>{row.cells[column.id].display}{row.cells[column.id].secondary && <small className="weight-secondary">{row.cells[column.id].secondary}</small>}{row.cells[column.id].caption && <small className="weight-caption">{row.cells[column.id].caption}</small>}</>}
          </td>)}
          {removing && <td className="remove-cell"><RemoveFileButton name={row.name} onRemove={() => onRemove(row.id)} /></td>}
        </tr>)}</tbody>
      </table>
    </div>
      <p id="row-selection-help" className="sr-only">{text.selectionKeyboardHint}</p>
    </div>
    {selection.editing && <RequirementPopover key={selection.editing.ids.join('|')} selection={selection.editing} hidden={selection.dragging}
      value={selection.editing.ids.length === 1 ? requirements[selection.editing.ids[0]] ?? null : null}
      onCommit={commitRequirement} onCancel={selection.cancel} />}
    {selectedEntry && <ResultDialog key={selectedEntry.id} entry={selectedEntry} onDismiss={() => setSelected(null)} />}
    {materialOpen && <MaterialDialog value={material} onApply={applyMaterial} onDismiss={() => setMaterialOpen(false)} />}
  </section>
}
