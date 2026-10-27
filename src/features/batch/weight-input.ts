import { positiveFinite, validWeightRange, type WeightRange } from '../../domain/weight'
import { toGrams, type WeightUnit } from '../../domain/weight-unit'
import { editableWeight } from '../../lib/weight-display'

export function parseRequirement(minimum: string, maximum: string, unit: WeightUnit = 'g', original: WeightRange | null = null): { range: WeightRange | null; error?: 'positive' | 'range' } {
  if (!minimum.trim() && !maximum.trim()) return { range: null }
  const val1 = original && minimum === editableWeight(original.min, unit) ? original.min : toGrams(Number(minimum), unit)
  const val2 = original && maximum === editableWeight(original.max, unit) ? original.max : toGrams(Number(maximum), unit)
  if (!positiveFinite(val1) || !positiveFinite(val2)) return { range: null, error: 'positive' }
  const min = Math.min(val1, val2)
  const max = Math.max(val1, val2)
  if (!validWeightRange({ min, max })) return { range: null, error: 'range' }
  return { range: { min, max } }
}

