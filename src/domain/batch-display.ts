/** Visible columns belong to the file list; sorting belongs only to the current opening. */
export const metricIds = ['volume', 'materialWeight', 'batWeight', 'length', 'maximumDiameter', 'gripDiameter'] as const
export type MetricId = typeof metricIds[number]
export interface BatchSort { key: 'name' | MetricId; direction: 'asc' | 'desc' }
export interface BatchDisplaySettings { visible: MetricId[] }
export const defaultMetricIds: MetricId[] = [...metricIds]
export const defaultSort: BatchSort = { key: 'materialWeight', direction: 'asc' }
export const createDefaultBatchSort = (): BatchSort => ({ ...defaultSort })
export const createDefaultBatchDisplay = (): BatchDisplaySettings => ({ visible: [...defaultMetricIds] })
const isMetricId = (value: unknown): value is MetricId => metricIds.some(id => id === value)

/** Invalid preferences fall back without losing saved files. */
export function normalizeBatchDisplay(value: unknown): BatchDisplaySettings {
  const defaults = createDefaultBatchDisplay()
  if (!value || typeof value !== 'object') return defaults
  const candidate = value as { visible?: unknown }
  if (Array.isArray(candidate.visible)) {
    const known = candidate.visible.filter(isMetricId)
    // An intentionally empty selection remains empty; a wholly unknown schema uses defaults.
    if (!candidate.visible.length || known.length) defaults.visible = [...new Set(known)]
  }
  return defaults
}
