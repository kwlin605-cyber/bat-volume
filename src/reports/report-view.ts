import type { BatchCell, BatchView } from '../features/batch/view-model'
import type { ReportFormat } from './formats'

export function reportView(view: BatchView, format: ReportFormat): BatchView {
  if (format !== 'xlsx' && !view.rows.some(row => row.cells.maximumDiameter.measurement || row.cells.gripDiameter.measurement)) return view
  const cellForFormat = ({ measurement, ...cell }: BatchCell): BatchCell => format !== 'xlsx' && measurement ? { ...cell, caption: measurement } : cell
  return { ...view, rows: view.rows.map(row => {
    const { sourceLabel, ...rest } = row
    return { ...rest, ...(format !== 'xlsx' && sourceLabel ? { sourceLabel } : {}), cells: {
      ...row.cells, maximumDiameter: cellForFormat(row.cells.maximumDiameter), gripDiameter: cellForFormat(row.cells.gripDiameter),
    } }
  }) }
}
