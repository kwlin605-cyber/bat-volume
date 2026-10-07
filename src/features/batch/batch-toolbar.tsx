import { useRef } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, Download, LoaderCircle, SlidersHorizontal, Settings2 } from 'lucide-react'
import type { WeightDisplayMode } from '../../domain/weight-unit'
import { text } from '../../i18n/zh-TW'
import { allMetricIds, metricColumns, type MetricId } from './columns'
import type { BatchSort } from './view-model'
import { WeightUnitSelector } from './weight-unit-selector'
import { useDismissibleMenus } from './use-dismissible-menus'

interface Props {
  visible: readonly MetricId[]; sort: BatchSort; sortLabel: string; weightUnit: WeightDisplayMode
  pending: boolean; exporting: boolean
  onVisibleChange: (visible: MetricId[]) => void; onSortChange: (sort: BatchSort) => void
  onUnitChange: (mode: WeightDisplayMode) => void; onMaterialOpen: () => void
  onExport: (format: 'png' | 'xlsx') => void
}

/** Display controls own their menus; calculations and report generation stay with the results. */
export function BatchToolbar({ visible, sort, sortLabel, weightUnit, pending, exporting,
  onVisibleChange, onSortChange, onUnitChange, onMaterialOpen, onExport }: Props) {
  const toolbar = useRef<HTMLDivElement>(null)
  const sortMenu = useRef<HTMLDetailsElement>(null)
  const downloadMenu = useRef<HTMLDetailsElement>(null)
  useDismissibleMenus(toolbar)
  function download(format: 'png' | 'xlsx') {
    if (pending || exporting) return
    if (downloadMenu.current) downloadMenu.current.open = false
    onExport(format)
  }
  return <div className="batch-tools" ref={toolbar}>
    <button type="button" className="material-settings-button" onClick={onMaterialOpen}><Settings2 size={15} />{text.materialSettings}</button>
    <details className="column-menu"><summary><SlidersHorizontal size={15} />{text.visibleInformation}<ChevronDown size={13} /></summary><div className="column-popover">
      <WeightUnitSelector value={weightUnit} onChange={onUnitChange} />
      <button type="button" onClick={() => onVisibleChange([...allMetricIds])}>{text.selectAllInformation}</button>
      {metricColumns.map(column => <label key={column.id}><input type="checkbox" checked={visible.includes(column.id)} onChange={event => onVisibleChange(event.target.checked ? [...visible, column.id] : visible.filter(id => id !== column.id))} />{column.label}</label>)}
    </div></details>
    <div className="batch-sort">
      <button className="sort-direction" type="button" aria-label={sort.direction === 'asc' ? text.sortAscending : text.sortDescending} onClick={() => onSortChange({ ...sort, direction: sort.direction === 'asc' ? 'desc' : 'asc' })}>
        {sortLabel}{sort.direction === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
      </button>
      <details className="sort-menu" ref={sortMenu}>
        <summary aria-label={text.sortBy} title={text.sortBy}><ChevronDown size={13} /></summary>
        <div className="sort-popover">{[{ id: 'name' as const, label: text.fileName }, ...metricColumns].map(column => <button key={column.id} type="button" aria-pressed={sort.key === column.id} onClick={() => { onSortChange({ ...sort, key: column.id }); if (sortMenu.current) sortMenu.current.open = false }}>{column.label}</button>)}</div>
      </details>
    </div>
    <details className="download-menu" ref={downloadMenu}>
      <summary aria-disabled={pending || exporting} onClick={event => { if (pending || exporting) event.preventDefault() }}>{exporting ? <LoaderCircle className="spin" size={15} /> : <Download size={15} />}{exporting ? text.preparingReport : text.downloadReport}<ChevronDown size={13} /></summary>
      <div className="download-popover"><button type="button" disabled={pending || exporting} onClick={() => download('xlsx')}>{text.excelDownload}</button><button type="button" disabled={pending || exporting} onClick={() => download('png')}>{text.pngDownload}</button></div>
    </details>
  </div>
}
