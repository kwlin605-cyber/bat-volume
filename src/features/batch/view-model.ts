import type { AnalysisEntry } from '../../services/analysis-state'
import { diagnosticText, gripDiagnosticText, text } from '../../i18n/zh-TW'
import { metricColumns, geometryColumns, columnsForUnits, type MetricId, type MetricColumn } from './columns'
import { calculateMaterialWeight, estimateBatWeight, type MaterialSettings, type WeightRange } from '../../domain/weight'
import { initialMaterialSettings } from '../../config/weight'
import { weightDisplay } from '../../lib/weight-display'
import { fromGrams, type WeightDisplayMode } from '../../domain/weight-unit'
import type { BatchSort } from '../../domain/batch-display'
import type { LengthDisplayMode } from '../../domain/length-unit'
import { halfInchValue, lengthDisplay, lengthNumberFormat } from '../../lib/length-display'
import { defaultBatGrouping } from '../../config/grouping'
import type { BatGroupingSettings } from '../../domain/bat-grouping'
import { orderBatchRows } from './row-order'
export { defaultSort, type BatchSort } from '../../domain/batch-display'

export interface BatchCell { value: number | null; display: string; maximum?: number; caption?: string; secondary?: string }
export interface WeightContext { material: MaterialSettings; requirements: Readonly<Record<string, WeightRange>>; weightUnit?: WeightDisplayMode }
const emptyWeightContext: WeightContext = { material: initialMaterialSettings, requirements: {} }
export interface BatchRow {
  id: string; name: string; pending: boolean; cells: Record<MetricId, BatchCell>
  status: { label: string; detail: string; kind: 'loading' | 'complete' | 'partial' | 'failed' }
}
export interface BatchView {
  rows: BatchRow[]; columns: MetricColumn[]; sort: BatchSort; sortLabel: string
  summary: { total: number; calculated: number; failed: number; pending: number }
}
export function buildBatchView(entries: readonly AnalysisEntry[], visible: readonly MetricId[], sort: BatchSort, weights: WeightContext = emptyWeightContext, lengthUnit: LengthDisplayMode = 'mm', grouping: BatGroupingSettings = defaultBatGrouping): BatchView {
  const weightUnit = weights.weightUnit ?? 'g'
  const weightCell = (value: number | null, maximum?: number, mode: WeightDisplayMode = 'g'): BatchCell => ({ value, ...(maximum === undefined ? {} : { maximum }),
    ...(value === null ? { display: text.missingValue } : weightDisplay(value, maximum, mode)) })
  const summary = { total: entries.length, calculated: 0, failed: 0, pending: 0 }
  const rows: BatchRow[] = entries.map(entry => {
    const result = entry.state.status === 'result' ? entry.state.result : null
    const calculated = result?.status === 'calculated' ? result : null
    const pending = entry.state.status === 'loading'
    if (pending) summary.pending++
    else if (calculated) summary.calculated++
    else summary.failed++
    const cells = Object.fromEntries(geometryColumns.map(column => {
      const value = calculated ? column.value(calculated) : null
      return [column.id, { value, ...(value === null ? { display: text.missingValue } : column.id === 'length' ? lengthDisplay(value, lengthUnit) : { display: column.format(value) }) }]
    })) as Record<MetricId, BatchCell>
    const required = weights.requirements[entry.id] ?? null
    const estimatedWeight = estimateBatWeight(weights.material, calculated?.volumeCm3 ?? null)
    cells.batWeight = required
      ? weightCell(required.min, required.max)
      : weightCell(estimatedWeight)
    const materialWeight = calculateMaterialWeight(weights.material, calculated?.volumeCm3 ?? null, required)
    cells.materialWeight = materialWeight.kind === 'reference'
      ? weightCell(materialWeight.weightG, undefined, weightUnit)
      : materialWeight.kind === 'recommended'
        ? weightCell(materialWeight.range.min, materialWeight.range.max, weightUnit)
        : { value: null, display: text.missingValue, ...(materialWeight.reason === 'materialTooSmall' ? { caption: text.materialTooSmall } : {}) }
    let status: BatchRow['status']
    if (pending) status = { label: text.loading, detail: '', kind: 'loading' }
    else if (calculated) {
      const grip = calculated.dimensions.grip
      status = grip.status === 'undetermined'
        ? { label: text.partialInformation, detail: gripDiagnosticText[grip.code], kind: 'partial' }
        : { label: calculated.estimated ? text.estimated : text.calculated, detail: '', kind: 'complete' }
    } else status = { label: text.failed, detail: result?.status === 'undetermined' ? diagnosticText[result.code] : '', kind: 'failed' }
    return { id: entry.id, name: entry.source.name, pending, cells, status }
  })
  return { rows: orderBatchRows(rows, sort, grouping), summary, columns: columnsForUnits(weightUnit, lengthUnit).filter(column => visible.includes(column.id)), sort,
    sortLabel: sort.key === 'name' ? text.fileName : metricColumns.find(column => column.id === sort.key)!.label }
}

export function reportCellValue(cell: BatchCell, column?: MetricColumn): string | number {
  if (cell.caption) return `${cell.display}\n${cell.caption}`
  if (cell.secondary) return `${cell.display}\n${cell.secondary}`
  if (cell.maximum !== undefined && cell.maximum !== cell.value) return cell.display
  return cell.value === null ? text.missingValue : column?.weightMode === 'oz' ? fromGrams(cell.value, 'oz') : column?.lengthMode === 'in' ? halfInchValue(cell.value) : cell.value
}

export function reportCellNumberFormat(cell: BatchCell, column: MetricColumn) {
  return column.lengthMode === 'in' && cell.value !== null ? lengthNumberFormat('in', cell.value) : column.numberFormat
}
