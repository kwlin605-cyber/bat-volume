import type { BatchView } from '../features/batch/view-model'
import type { ReportFormat } from './formats'

export function reportView(view: BatchView, format: ReportFormat): BatchView {
  return format === 'xlsx' ? { ...view, rows: view.rows.map(({ sourceLabel: _, ...row }) => row) } : view
}
