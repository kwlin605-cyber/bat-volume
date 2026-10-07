/** All stored weights use grams. Conversion never rounds the source value. */
export type WeightUnit = 'g' | 'oz'
export type WeightDisplayMode = WeightUnit | 'both'
export const gramsPerOunce = 28.349523125
export const weightDisplayModes: readonly WeightDisplayMode[] = ['g', 'oz', 'both']
export const inputWeightUnit = (mode: WeightDisplayMode): WeightUnit => mode === 'oz' ? 'oz' : 'g'
export const fromGrams = (grams: number, unit: WeightUnit) => unit === 'oz' ? grams / gramsPerOunce : grams
export const toGrams = (value: number, unit: WeightUnit) => unit === 'oz' ? value * gramsPerOunce : value
export const isWeightDisplayMode = (value: unknown): value is WeightDisplayMode => weightDisplayModes.some(mode => mode === value)
