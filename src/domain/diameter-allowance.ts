/** Total diameter reduction for displayed finishing dimensions; not a radial offset. */
export const defaultDiameterAllowanceMm = 0
export const validDiameterAllowance = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0

export function parseDiameterAllowance(draft: string): number | null {
  if (!draft.trim()) return defaultDiameterAllowanceMm
  const value = Number(draft)
  return validDiameterAllowance(value) ? value : null
}

export function finishedDiameter(rawMm: number | null, allowanceMm = defaultDiameterAllowanceMm): number | null {
  if (rawMm === null || !Number.isFinite(rawMm) || !validDiameterAllowance(allowanceMm)) return null
  const value = rawMm - allowanceMm
  return value > 0 ? value : null
}
