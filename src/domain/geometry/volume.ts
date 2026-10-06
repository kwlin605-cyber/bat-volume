import { AnalysisError } from '../types'
import type { Cuts, ProfilePoint } from '../types'

function atY(points: ProfilePoint[], y: number): ProfilePoint {
  const exact = points.find(point => point.y === y)
  if (exact) return exact
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1], next = points[index]
    if (previous.y < y && y < next.y) {
      const fraction = (y - previous.y) / (next.y - previous.y)
      return { y, radius: previous.radius + (next.radius - previous.radius) * fraction, line: next.line }
    }
  }
  throw new AnalysisError('invalidCuts')
}

export function clipProfile(points: ProfilePoint[], cuts: Cuts): ProfilePoint[] {
  if (!points.length || !(cuts.low < cuts.high) || cuts.low < points[0].y || cuts.high > points.at(-1)!.y) {
    throw new AnalysisError('invalidCuts')
  }
  const within = points.filter(point => point.y >= cuts.low && point.y <= cuts.high)
  if (!within.length || within[0].y > cuts.low) within.unshift(atY(points, cuts.low))
  if (within.at(-1)!.y < cuts.high) within.push(atY(points, cuts.high))
  return within
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
