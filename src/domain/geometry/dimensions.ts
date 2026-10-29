import { clipProfile } from './volume'
import { detectGripRegion } from '../grip/registry'
import type { BatDimensions, DiameterDistances, GripContext, GripMeasurement, GripStrategy, MeasurementRange, ProfilePoint } from '../types'

function radiusRanges(points: readonly ProfilePoint[], radius: number): MeasurementRange[] {
  const ranges: MeasurementRange[] = []
  // Only absorb floating-point roundoff; a real slope must not become a plateau.
  const matches = (value: number) => Math.abs(value - radius) <= Number.EPSILON * Math.max(1, value, radius) * 8
  for (let index = 0; index < points.length; index++) {
    const point = points[index]
    if (!matches(point.radius)) continue
    const startMm = index > 0 && matches(points[index - 1].radius) ? points[index - 1].y : point.y
    const previous = ranges.at(-1)
    if (previous && startMm <= previous.endMm) previous.endMm = point.y
    else ranges.push({ startMm, endMm: point.y })
  }
  return ranges
}

function fromFace(ranges: readonly MeasurementRange[], face: number, direction: 1 | -1): MeasurementRange[] {
  return ranges.map(range => {
    const a = (range.startMm - face) * direction, b = (range.endMm - face) * direction
    return { startMm: Math.max(0, Math.min(a, b)), endMm: Math.max(0, a, b) }
  }).sort((a, b) => a.startMm - b.startMm)
}

export function measureDimensions(points: ProfilePoint[], context: GripContext, strategies?: readonly GripStrategy[]): BatDimensions {
  const lengthMm = points.at(-1)!.y - points[0].y
  const maximum = points.reduce((a, b) => b.radius > a.radius ? b : a)
  const maximumDiameterMm = maximum.radius * 2
  const { decision, rule } = detectGripRegion(points, context, strategies)
  let grip: GripMeasurement
  let distances: DiameterDistances | null = null
  if (decision.status === 'detected' && rule) {
    const regionPoints = clipProfile(points, decision.region)
    const minimum = regionPoints.reduce((a, b) => b.radius < a.radius ? b : a)
    grip = { status: 'detected', diameterMm: minimum.radius * 2, minimum, region: decision.region, end: decision.end, rule }
    const low = points[0].y, high = points.at(-1)!.y
    distances = {
      head: fromFace(radiusRanges(points, maximum.radius), decision.end === 'low' ? high : low, decision.end === 'low' ? -1 : 1),
      grip: fromFace(radiusRanges(regionPoints, minimum.radius), decision.end === 'low' ? low : high, decision.end === 'low' ? 1 : -1),
    }
  } else {
    grip = { status: 'undetermined', code: decision.status === 'undetermined' ? decision.code : 'noApplicableGripStrategy' }
  }
  return { lengthMm, maximumDiameterMm, maximum, grip, distances }
}
