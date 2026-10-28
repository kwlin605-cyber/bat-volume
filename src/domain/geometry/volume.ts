import { AnalysisError } from '../types'
import type { Cuts, ProfilePoint } from '../types'
import { profilePointAt } from './profile'

export function clipProfile(points: ProfilePoint[], cuts: Cuts): ProfilePoint[] {
  if (!points.length || !(cuts.low < cuts.high) || cuts.low < points[0].y || cuts.high > points.at(-1)!.y) {
    throw new AnalysisError('invalidCuts')
  }
  return [
    profilePointAt(points, cuts.low, 'right'),
    ...points.filter(point => point.y > cuts.low && point.y < cuts.high),
    profilePointAt(points, cuts.high, 'left'),
  ]
}

export function integrateVolumeMm3(points: ProfilePoint[]): number {
  let sum = 0, compensation = 0
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1], b = points[index]
    const length = b.y - a.y
    if (length < 0 || a.radius < 0 || b.radius < 0 || !Number.isFinite(a.radius + b.radius + length)) {
      throw new AnalysisError('invalidRadius')
    }
    // Exact integral for each linear-radius segment, including clipped segments.
    const value = Math.PI * length * (a.radius * a.radius + a.radius * b.radius + b.radius * b.radius) / 3
    const corrected = value - compensation
    const next = sum + corrected
    compensation = (next - sum) - corrected
    sum = next
  }
  if (!Number.isFinite(sum) || !(sum > 0)) throw new AnalysisError('invalidRadius')
  return sum
}
