import type { BatchSort, MetricId } from '../../domain/batch-display'
import { batGroupRank, classifyBat, type BatGroup, type BatGroupingSettings } from '../../domain/bat-grouping'
import { text } from '../../i18n/zh-TW'

interface SortableRow {
  group?: BatGroup
  rawMaximumDiameterMm?: number | null
  name: string
  cells: Record<MetricId, { value: number | null; maximum?: number }>
}

/** Group priority is independent of the shared numeric/name sorting direction. */
export function orderBatchRows<Row extends SortableRow>(rows: readonly Row[], sort: BatchSort, grouping: BatGroupingSettings): Row[] {
  const collator = new Intl.Collator(text.locale, { numeric: true, sensitivity: 'base' })
  const direction = sort.direction === 'asc' ? 1 : -1
  const rank = (row: Row) => batGroupRank(row.group ?? classifyBat(row.rawMaximumDiameterMm === undefined ? row.cells.maximumDiameter.value : row.rawMaximumDiameterMm, grouping), grouping.firstGroup)
  return [...rows].sort((a, b) => {
    const groupDifference = rank(a) - rank(b)
    if (groupDifference) return groupDifference
    if (sort.key === 'name') return direction * collator.compare(a.name, b.name)
    const av = a.cells[sort.key].value, bv = b.cells[sort.key].value
    if (av === null || bv === null) return av === bv ? collator.compare(a.name, b.name) : av === null ? 1 : -1
    return direction * (av - bv) || direction * ((a.cells[sort.key].maximum ?? av) - (b.cells[sort.key].maximum ?? bv)) || collator.compare(a.name, b.name)
  })
}
