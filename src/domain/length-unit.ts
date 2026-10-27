/** Geometry remains in millimetres; conversion never rounds the source. */
export type LengthUnit = 'cm' | 'in'
export type LengthDisplayMode = LengthUnit | 'both'
export const millimetresPerInch = 25.4
export const lengthDisplayModes: readonly LengthDisplayMode[] = ['cm', 'in', 'both']
export const fromMillimetres = (mm: number, unit: LengthUnit) => unit === 'in' ? mm / millimetresPerInch : mm / 10
export const isLengthDisplayMode = (value: unknown): value is LengthDisplayMode => lengthDisplayModes.some(mode => mode === value)
