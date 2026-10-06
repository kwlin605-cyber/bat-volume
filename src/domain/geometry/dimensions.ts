import { clipProfile } from './volume'
import { detectGripRegion } from '../grip/registry'
import type { BatDimensions, GripContext, GripMeasurement, GripStrategy, ProfilePoint } from '../types'

export function measureDimensions(points: ProfilePoint[], context: GripContext, strategies?: readonly GripStrategy[]): BatDimensions {
  const lengthMm = points.at(-1)!.y - points[0].y
  const maximum = points.reduce((a, b) => b.radius > a.radius ? b : a)
  const maximumDiameterMm = maximum.radius * 2
  const { decision, rule } = detectGripRegion(points, context, strategies)
  let grip: GripMeasurement
  if (decision.status === 'detected' && rule) {
    const regionPoints = clipProfile(points, decision.region)
    const minimum = regionPoints.reduce((a, b) => b.radius < a.radius ? b : a)
    grip = { status: 'detected', diameterMm: minimum.radius * 2, minimum, region: decision.region, end: decision.end, rule }
  } else {
    grip = { status: 'undetermined', code: decision.status === 'undetermined' ? decision.code : 'noApplicableGripStrategy' }
  }
  return { lengthMm, maximumDiameterMm, maximum, grip }
}
