export interface MaterialSettings { referenceDensity: number; volumeCm3: number | null; weightG: number | null; weightErrorPercent: number }
export interface WeightRange { min: number; max: number }
export type MaterialWeight =
  | { kind: 'reference'; weightG: number }
  | { kind: 'recommended'; range: WeightRange }
  | { kind: 'unavailable'; reason: 'missingMaterialVolume' | 'missingBatVolume' | 'materialTooSmall' | 'invalidWeight' }

export const positiveFinite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0
export const validWeightError = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > -100
export const validWeightRange = (value: WeightRange) => positiveFinite(value.min) && positiveFinite(value.max) && value.max >= value.min
export function materialDensity(material: MaterialSettings) {
  return positiveFinite(material.volumeCm3) && positiveFinite(material.weightG)
    ? material.weightG / material.volumeCm3 : material.referenceDensity
}
export function estimateBatWeight(material: MaterialSettings, batVolumeCm3: number | null): number | null {
  if (!positiveFinite(batVolumeCm3)) return null
  const weightG = batVolumeCm3 * materialDensity(material)
  return positiveFinite(weightG) ? weightG : null
}
export function calculateMaterialWeight(material: MaterialSettings, batVolumeCm3: number | null, required: WeightRange | null): MaterialWeight {
  if (!positiveFinite(material.volumeCm3)) return { kind: 'unavailable', reason: 'missingMaterialVolume' }
  if (!required) {
    const weightG = positiveFinite(material.weightG) ? material.weightG : material.volumeCm3 * materialDensity(material)
    return positiveFinite(weightG) ? { kind: 'reference', weightG } : { kind: 'unavailable', reason: 'invalidWeight' }
  }
  if (!validWeightRange(required)) return { kind: 'unavailable', reason: 'invalidWeight' }
  if (!positiveFinite(batVolumeCm3)) return { kind: 'unavailable', reason: 'missingBatVolume' }
  if (material.volumeCm3 < batVolumeCm3) return { kind: 'unavailable', reason: 'materialTooSmall' }
  if (!validWeightError(material.weightErrorPercent)) return { kind: 'unavailable', reason: 'invalidWeight' }
  // The measured error changes the raw weight needed to meet an unchanged target.
  const ratio = (material.volumeCm3 / batVolumeCm3) / (1 + material.weightErrorPercent / 100)
  const range = { min: required.min * ratio, max: required.max * ratio }
  return validWeightRange(range) ? { kind: 'recommended', range } : { kind: 'unavailable', reason: 'invalidWeight' }
}
