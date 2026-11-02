import { massPropertyPivotMm } from '../../config/mass-properties'
import type { MassProperties, ProfilePoint } from '../types'
import { profilePointAt } from './profile'
import { integrateVolumeMm3 } from './volume'

// Three-point Gaussian integration is exact for the degree-four polynomials
// of a linear-radius solid, including its transverse cross-section inertia.
const integrationNodes = [
  { t: (1 - Math.sqrt(3 / 5)) / 2, weight: 5 / 18 },
  { t: 0.5, weight: 4 / 9 },
  { t: (1 + Math.sqrt(3 / 5)) / 2, weight: 5 / 18 },
]

export function calculateMassProperties(points: ProfilePoint[], knobEnd: 'low' | 'high' | null): MassProperties {
  const volume = integrateVolumeMm3(points)
  const origin = points[0].y
  const integrate = (value: (x: number, radius: number) => number) => {
    let result = 0
    for (let index = 1; index < points.length; index++) {
      const a = points[index - 1], b = points[index], length = b.y - a.y
      if (!length) continue
      for (const { t, weight } of integrationNodes) {
        result += length * weight * value(a.y - origin + length * t, a.radius + (b.radius - a.radius) * t)
      }
    }
    return result
  }
  const centerOffset = integrate((x, r) => Math.PI * r * r * x) / volume
  const centralPerMass = integrate((x, r) => Math.PI * (r * r * (x - centerOffset) ** 2 + r ** 4 / 4)) / volume
  const center = profilePointAt(points, origin + centerOffset)
  const balancePointMm = knobEnd === null ? null : knobEnd === 'low' ? centerOffset : points.at(-1)!.y - origin - centerOffset
  return {
    center,
    balancePointMm,
    inertiaPerMassMm2: balancePointMm === null ? null : centralPerMass + (balancePointMm - massPropertyPivotMm) ** 2,
  }
}
