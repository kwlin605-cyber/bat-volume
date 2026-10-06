import { AnalysisError } from '../types'
import type { GeometryCalibration, Profile, Program } from '../types'

export function extractProfile(program: Program, calibration: GeometryCalibration): Profile {
  const maximumSpan = program.sweeps.reduce((maximum, sweep) => Math.max(maximum, sweep.span), 0)
  if (!(maximumSpan > 0)) throw new AnalysisError('noProfile')
  // Later full-length passes supersede the earlier roughing passes.
  const sweep = program.sweeps.filter(candidate => candidate.span >= maximumSpan * 0.95).at(-1)!
  let direction = 0
  const firstX = sweep.points[0].x
  for (let index = 0; index < sweep.points.length; index++) {
    const point = sweep.points[index]
    if (Math.abs(point.x - firstX) > 0.001) throw new AnalysisError('nonAxisymmetricProfile')
    if (index === 0) continue
    const movement = Math.sign(point.y - sweep.points[index - 1].y)
    if (movement && direction && direction !== movement) throw new AnalysisError('nonMonotoneProfile')
    if (movement) direction = movement
  }
  const points = sweep.points.map(point => ({
    y: point.y,
    radius: point.z * calibration.radiusScale + calibration.radiusOffsetMm,
    line: point.line,
  }))
  if (points.some(point => !Number.isFinite(point.radius) || point.radius < 0)) throw new AnalysisError('invalidRadius')
  if (direction < 0) points.reverse()
  return {
    points,
    range: { low: points[0].y, high: points.at(-1)!.y },
    sourceLines: { start: sweep.points[0].line, end: sweep.points.at(-1)!.line },
    sweepCount: program.sweeps.length,
  }
}
