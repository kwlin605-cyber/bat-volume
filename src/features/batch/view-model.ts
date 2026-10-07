import type { AnalysisEntry } from '../../services/analysis-state'
import { diagnosticText, gripDiagnosticText, text } from '../../i18n/zh-TW'
import { metricColumns, geometryColumns, columnsForWeightUnit, type MetricId, type MetricColumn } from './columns'
import { calculateMaterialWeight, estimateBatWeight, type MaterialSettings, type WeightRange } from '../../domain/weight'
import { initialMaterialSettings } from '../../config/weight'
import { weightDisplay } from '../../lib/weight-display'
import { fromGrams, type WeightDisplayMode } from '../../domain/weight-unit'

export interface BatchSort { key: 'name' | MetricId; direction: 'asc' | 'desc' }
export const defaultSort: BatchSort = { key: 'name', direction: 'asc' }
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
export function buildBatchView(entries: readonly AnalysisEntry[], visible: readonly MetricId[], sort: BatchSort, weights: WeightContext = emptyWeightContext): BatchView {
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
      return [column.id, { value, display: value === null ? text.missingValue : column.format(value) }]
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
  const collator = new Intl.Collator(text.locale, { numeric: true, sensitivity: 'base' })
  const direction = sort.direction === 'asc' ? 1 : -1
  rows.sort((a, b) => {
    if (sort.key === 'name') return direction * collator.compare(a.name, b.name)
    const av = a.cells[sort.key].value, bv = b.cells[sort.key].value
    if (av === null || bv === null) return av === bv ? collator.compare(a.name, b.name) : av === null ? 1 : -1
    return direction * (av - bv) || direction * ((a.cells[sort.key].maximum ?? av) - (b.cells[sort.key].maximum ?? bv)) || collator.compare(a.name, b.name)
  })
  return { rows, summary, columns: columnsForWeightUnit(weightUnit).filter(column => visible.includes(column.id)), sort,
    sortLabel: sort.key === 'name' ? text.fileName : metricColumns.find(column => column.id === sort.key)!.label }
}

export function reportCellValue(cell: BatchCell, column?: MetricColumn): string | number {
  if (cell.caption) return `${cell.display}\n${cell.caption}`
  if (cell.secondary) return `${cell.display}\n${cell.secondary}`
  if (cell.maximum !== undefined && cell.maximum !== cell.value) return cell.display
  return cell.value === null ? text.missingValue : column?.weightMode === 'oz' ? fromGrams(cell.value, 'oz') : cell.value
}
