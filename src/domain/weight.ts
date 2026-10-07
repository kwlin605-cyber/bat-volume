export interface MaterialSettings { referenceDensity: number | null; volumeCm3: number | null; weightG: number | null; weightErrorPercent: number | null }
export interface WeightRange { min: number; max: number }
export type MaterialWeight =
  | { kind: 'reference'; weightG: number }
  | { kind: 'recommended'; range: WeightRange }
  | { kind: 'unavailable'; reason: 'missingMaterialVolume' | 'missingBatVolume' | 'materialTooSmall' | 'invalidWeight' }

export const positiveFinite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0
export const validWeightError = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > -100
export const validWeightRange = (value: WeightRange) => positiveFinite(value.min) && positiveFinite(value.max) && value.max >= value.min
export function weightCorrectionFactor(error: number | null): number | null {
  return error === null ? 1 : validWeightError(error) ? 1 + error / 100 : null
}
export function materialDensity(material: MaterialSettings) {
  const density = positiveFinite(material.volumeCm3) && positiveFinite(material.weightG)
    ? material.weightG / material.volumeCm3 : material.referenceDensity
  return positiveFinite(density) ? density : null
}
export function estimateBatWeight(material: MaterialSettings, batVolumeCm3: number | null): number | null {
  if (!positiveFinite(batVolumeCm3)) return null
  const density = materialDensity(material), factor = weightCorrectionFactor(material.weightErrorPercent)
  if (density === null || factor === null) return null
  const weightG = batVolumeCm3 * density * factor
  return positiveFinite(weightG) ? weightG : null
}
export function calculateMaterialWeight(material: MaterialSettings, batVolumeCm3: number | null, required: WeightRange | null): MaterialWeight {
  if (!positiveFinite(material.volumeCm3)) return { kind: 'unavailable', reason: 'missingMaterialVolume' }
  if (!required) {
    const density = materialDensity(material)
    const weightG = positiveFinite(material.weightG) ? material.weightG : density === null ? null : material.volumeCm3 * density
    return positiveFinite(weightG) ? { kind: 'reference', weightG } : { kind: 'unavailable', reason: 'invalidWeight' }
  }
  if (!validWeightRange(required)) return { kind: 'unavailable', reason: 'invalidWeight' }
  if (!positiveFinite(batVolumeCm3)) return { kind: 'unavailable', reason: 'missingBatVolume' }
  if (material.volumeCm3 < batVolumeCm3) return { kind: 'unavailable', reason: 'materialTooSmall' }
  const factor = weightCorrectionFactor(material.weightErrorPercent)
  if (factor === null) return { kind: 'unavailable', reason: 'invalidWeight' }
  // The measured error changes the raw weight needed to meet an unchanged target.
  const ratio = (material.volumeCm3 / batVolumeCm3) / factor
  const range = { min: required.min * ratio, max: required.max * ratio }
  return validWeightRange(range) ? { kind: 'recommended', range } : { kind: 'unavailable', reason: 'invalidWeight' }
}
