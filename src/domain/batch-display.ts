/** Presentation preferences belong to the current file list, never to geometry calculations. */
export const metricIds = ['volume', 'materialWeight', 'batWeight', 'length', 'maximumDiameter', 'gripDiameter'] as const
export type MetricId = typeof metricIds[number]
export interface BatchSort { key: 'name' | MetricId; direction: 'asc' | 'desc' }
export interface BatchDisplaySettings { visible: MetricId[]; sort: BatchSort }
export const defaultMetricIds: MetricId[] = ['volume', 'materialWeight', 'batWeight']
export const defaultSort: BatchSort = { key: 'name', direction: 'asc' }
export const createDefaultBatchDisplay = (): BatchDisplaySettings => ({ visible: [...defaultMetricIds], sort: { ...defaultSort } })
const isMetricId = (value: unknown): value is MetricId => metricIds.some(id => id === value)

/** Missing older preferences or invalid individual fields fall back without losing saved files. */
export function normalizeBatchDisplay(value: unknown): BatchDisplaySettings {
  const defaults = createDefaultBatchDisplay()
  if (!value || typeof value !== 'object') return defaults
  const candidate = value as { visible?: unknown; sort?: { key?: unknown; direction?: unknown } | null }
  if (Array.isArray(candidate.visible)) {
    const known = candidate.visible.filter(isMetricId)
    // An intentionally empty selection remains empty; a wholly unknown schema uses defaults.
    if (!candidate.visible.length || known.length) defaults.visible = [...new Set(known)]
  }
  if (candidate.sort?.key === 'name' || isMetricId(candidate.sort?.key)) defaults.sort.key = candidate.sort.key
  if (candidate.sort?.direction === 'asc' || candidate.sort?.direction === 'desc') defaults.sort.direction = candidate.sort.direction
  return defaults
}
