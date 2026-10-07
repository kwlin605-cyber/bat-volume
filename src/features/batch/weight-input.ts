import { positiveFinite, validWeightRange, type WeightRange } from '../../domain/weight'
import { toGrams, type WeightUnit } from '../../domain/weight-unit'
import { editableWeight } from '../../lib/weight-display'

export function parseRequirement(minimum: string, maximum: string, unit: WeightUnit = 'g', original: WeightRange | null = null): { range: WeightRange | null; error?: 'positive' | 'range' } {
  if (!minimum.trim() && !maximum.trim()) return { range: null }
  const min = original && minimum === editableWeight(original.min, unit) ? original.min : toGrams(Number(minimum), unit)
  const max = original && maximum === editableWeight(original.max, unit) ? original.max : toGrams(Number(maximum), unit)
  if (!positiveFinite(min) || !positiveFinite(max)) return { range: null, error: 'positive' }
  if (!validWeightRange({ min, max })) return { range: null, error: 'range' }
  return { range: { min, max } }
}
