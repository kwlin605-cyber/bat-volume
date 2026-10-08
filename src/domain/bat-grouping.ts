import { defaultBatGrouping } from '../config/grouping'

export type ClassifiedBatGroup = 'softball' | 'baseball'
export type BatGroup = ClassifiedBatGroup | 'unclassified'
export interface BatGroupingSettings { diameterThresholdMm: number; firstGroup: ClassifiedBatGroup }
export const validDiameterThreshold = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0
const isClassifiedGroup = (value: unknown): value is ClassifiedBatGroup => value === 'softball' || value === 'baseball'

/** Classification uses retained geometry in millimetres, independent of names and display rounding. */
export function classifyBat(diameterMm: number | null, settings: BatGroupingSettings): BatGroup {
  if (!validDiameterThreshold(diameterMm)) return 'unclassified'
  return diameterMm < settings.diameterThresholdMm ? 'softball' : 'baseball'
}

export function batGroupRank(group: BatGroup, first: ClassifiedBatGroup): number {
  return group === 'unclassified' ? 2 : group === first ? 0 : 1
}

export function isBatGroupingSettings(value: unknown): value is BatGroupingSettings {
  if (!value || typeof value !== 'object') return false
  const input = value as Partial<BatGroupingSettings>
  return validDiameterThreshold(input.diameterThresholdMm) && isClassifiedGroup(input.firstGroup)
}

/** Recover individual invalid fields without discarding the other saved preference. */
export function normalizeBatGrouping(value: unknown): BatGroupingSettings {
  const input = value && typeof value === 'object' ? value as Partial<BatGroupingSettings> : {}
  return {
    diameterThresholdMm: validDiameterThreshold(input.diameterThresholdMm) ? input.diameterThresholdMm : defaultBatGrouping.diameterThresholdMm,
    firstGroup: isClassifiedGroup(input.firstGroup) ? input.firstGroup : defaultBatGrouping.firstGroup,
  }
}
