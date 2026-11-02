import type { AnalysisResult, ProfilePoint } from './types'
import { estimateBatWeight, positiveFinite, type MaterialSettings, type WeightRange } from './weight'

export interface BatProperties {
  weightG: WeightRange | null
  center: ProfilePoint | null
  balancePointMm: number | null
  moiKgM2: { min: number; max: number } | null
}

export function calculateBatProperties(result: AnalysisResult | null, material: MaterialSettings, required: WeightRange | null): BatProperties {
  const calculated = result?.status === 'calculated' ? result : null
  const estimated = estimateBatWeight(material, calculated?.volumeCm3 ?? null)
  const weightG = required ?? (estimated === null ? null : { min: estimated, max: estimated })
  const geometry = calculated?.massProperties ?? null
  const factor = geometry?.inertiaPerMassMm2
  const moi = factor === null || factor === undefined || !weightG ? null
    : { min: weightG.min * (factor / 1e9), max: weightG.max * (factor / 1e9) }
  return {
    weightG,
    center: geometry?.center ?? null,
    balancePointMm: geometry?.balancePointMm ?? null,
    moiKgM2: moi && positiveFinite(moi.min) && positiveFinite(moi.max) ? moi : null,
  }
}
