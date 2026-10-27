import { useRef } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, Download, SlidersHorizontal, Settings2 } from 'lucide-react'
import type { WeightDisplayMode } from '../../domain/weight-unit'
import { text } from '../../i18n/zh-TW'
import { allMetricIds, metricColumns, type MetricId } from './columns'
import type { BatchSort } from './view-model'
import { WeightUnitSelector } from './weight-unit-selector'
import { useDismissibleMenus } from './use-dismissible-menus'
import { lengthDisplayModes, type LengthDisplayMode } from '../../domain/length-unit'
import { lengthModeLabel } from '../../lib/length-display'
import { UnitSelector } from './unit-selector'
import { reportFormats, type ReportFormat } from '../../reports/formats'
import type { BatGroupingSettings } from '../../domain/bat-grouping'
import { GroupingControls } from './grouping-controls'
import { DiameterAllowanceControl } from './diameter-allowance-control'

interface Props {
  diameterAllowanceMm: number; onDiameterAllowanceChange: (value: number) => void
  visible: readonly MetricId[]; sort: BatchSort; sortLabel: string; weightUnit: WeightDisplayMode
  pending: boolean
  lengthUnit: LengthDisplayMode; onLengthUnitChange: (mode: LengthDisplayMode) => void
  onVisibleChange: (visible: MetricId[]) => void; onSortChange: (sort: BatchSort) => void
  onUnitChange: (mode: WeightDisplayMode) => void; onMaterialOpen: () => void
  onExport: (format: ReportFormat) => void
  grouping: BatGroupingSettings; onGroupingChange: (value: BatGroupingSettings) => void
}

/** Display controls own their menus; calculations and report generation stay with the results. */
export function BatchToolbar({ visible, sort, sortLabel, weightUnit, lengthUnit, pending,
  onVisibleChange, onSortChange, onUnitChange, onLengthUnitChange, onMaterialOpen, onExport, grouping, onGroupingChange, diameterAllowanceMm, onDiameterAllowanceChange }: Props) {
  const toolbar = useRef<HTMLDivElement>(null)
  const sortMenu = useRef<HTMLDetailsElement>(null)
  const downloadMenu = useRef<HTMLDetailsElement>(null)
  useDismissibleMenus(toolbar)
  function download(format: ReportFormat) {
    if (pending) return
    if (downloadMenu.current) downloadMenu.current.open = false
    onExport(format)
  }
  return <div className="batch-tools" ref={toolbar}>
    <button type="button" className="material-settings-button" onClick={onMaterialOpen}><Settings2 size={15} />{text.materialSettings}</button>
    <details className="column-menu"><summary><SlidersHorizontal size={15} />{text.visibleInformation}<ChevronDown size={13} /></summary><div className="column-popover">
      <WeightUnitSelector value={weightUnit} onChange={onUnitChange} />
      <UnitSelector label={text.lengthDisplayUnit} modes={lengthDisplayModes} value={lengthUnit} modeLabel={lengthModeLabel} onChange={onLengthUnitChange} />
      <DiameterAllowanceControl value={diameterAllowanceMm} onChange={onDiameterAllowanceChange} />
      <button type="button" onClick={() => onVisibleChange([...allMetricIds])}>{text.selectAllInformation}</button>
      {metricColumns.map(column => <label key={column.id}><input type="checkbox" checked={visible.includes(column.id)} onChange={event => onVisibleChange(event.target.checked ? [...visible, column.id] : visible.filter(id => id !== column.id))} />{column.label}</label>)}
    </div></details>
    <div className="batch-sort">
      <button className="sort-direction" type="button" title={sort.key === 'name' ? text.sortNameHint : text.sortNumericHint} aria-label={sort.direction === 'asc' ? text.sortAscending : text.sortDescending} onClick={() => onSortChange({ ...sort, direction: sort.direction === 'asc' ? 'desc' : 'asc' })}>
        {sortLabel}{sort.direction === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
      </button>
      <details className="sort-menu" ref={sortMenu}>
        <summary aria-label={text.sortBy} title={text.sortBy}><ChevronDown size={13} /></summary>
        <div className="sort-popover"><GroupingControls value={grouping} onChange={onGroupingChange} />
          {[{ id: 'name' as const, label: text.fileName }, ...metricColumns].map(column => <button key={column.id} type="button" aria-pressed={sort.key === column.id} onClick={() => { onSortChange({ ...sort, key: column.id }); if (sortMenu.current) sortMenu.current.open = false }}>{column.label}</button>)}
        </div>
      </details>
    </div>
    <details className="download-menu" ref={downloadMenu}>
      <summary aria-disabled={pending} onClick={event => { if (pending) event.preventDefault() }}><Download size={15} />{text.downloadReport}<ChevronDown size={13} /></summary>
      <div className="download-popover">{reportFormats.map(format => <button key={format.id} type="button" disabled={pending} onClick={() => download(format.id)}>{format.label}</button>)}</div>
    </details>
  </div>
}
