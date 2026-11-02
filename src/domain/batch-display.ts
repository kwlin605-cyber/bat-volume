/** Display catalog shared by persisted file-list choices and current-opening choices. */
export const metricIds = ['volume', 'materialWeight', 'batWeight', 'length', 'maximumDiameter', 'gripDiameter', 'balancePoint', 'moi'] as const
export type MetricId = typeof metricIds[number]
export interface BatchSort { key: 'name' | MetricId; direction: 'asc' | 'desc' }
export interface BatchDisplaySettings { visible: MetricId[]; showMeasurementDistances: boolean }
export const isTemporaryMetric = (id: MetricId) => id === 'balancePoint' || id === 'moi'
export const defaultMetricIds: MetricId[] = metricIds.filter(id => !isTemporaryMetric(id))
export const defaultSort: BatchSort = { key: 'materialWeight', direction: 'asc' }
export const createDefaultBatchSort = (): BatchSort => ({ ...defaultSort })
export const createDefaultBatchDisplay = (): BatchDisplaySettings => ({ visible: [...defaultMetricIds], showMeasurementDistances: false })
const isMetricId = (value: unknown): value is MetricId => metricIds.some(id => id === value)

/** Invalid preferences fall back without losing saved files. */
export function normalizeBatchDisplay(value: unknown): BatchDisplaySettings {
  const defaults = createDefaultBatchDisplay()
  if (!value || typeof value !== 'object') return defaults
  const candidate = value as { visible?: unknown; showMeasurementDistances?: unknown }
  if (typeof candidate.showMeasurementDistances === 'boolean') defaults.showMeasurementDistances = candidate.showMeasurementDistances
  if (Array.isArray(candidate.visible)) {
    const known = candidate.visible.filter(isMetricId)
    // An intentionally empty selection remains empty; a wholly unknown schema uses defaults.
    if (!candidate.visible.length || known.length) defaults.visible = [...new Set(known)]
  }
  return defaults
}

/** Only the new physical-property columns reset when reopening the page. */
export function persistentBatchDisplay(value: BatchDisplaySettings): BatchDisplaySettings {
  return { ...value, visible: value.visible.filter(id => !isTemporaryMetric(id)) }
}
