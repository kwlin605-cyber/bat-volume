/**
 * Blade width (in millimetres) for flat circular saw blade simulation.
 * When > 0, cutting passes are swept with a flat blade of this width (centered at Y).
 * When 0, raw G-code points are used without blade width compensation.
 */
export const defaultBladeWidthMm = 5.0

export const validBladeWidth = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

export function parseBladeWidth(draft: string): number | null {
  if (!draft.trim()) return 0
  const value = Number(draft)
  return validBladeWidth(value) ? value : null
}
