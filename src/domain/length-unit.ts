/** Geometry remains in millimetres; conversion never rounds the source. */
export type LengthUnit = 'mm' | 'in'
export type LengthDisplayMode = LengthUnit | 'both'
export const millimetresPerInch = 25.4
export const lengthDisplayModes: readonly LengthDisplayMode[] = ['mm', 'in', 'both']
export const fromMillimetres = (mm: number, unit: LengthUnit) => unit === 'in' ? mm / millimetresPerInch : mm
export const isLengthDisplayMode = (value: unknown): value is LengthDisplayMode => lengthDisplayModes.some(mode => mode === value)
