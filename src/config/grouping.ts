import type { BatGroupingSettings } from '../domain/bat-grouping'

export const defaultBatGrouping: BatGroupingSettings = { diameterThresholdMm: 60, firstGroup: 'softball' }
export const batGroupingStorage = { key: 'bat-volume.grouping', version: 1 } as const
