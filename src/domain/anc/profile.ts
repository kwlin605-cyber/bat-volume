import { AnalysisError } from '../types'
import type { GeometryCalibration, Profile, ProfilePoint, Program } from '../types'

function simplifyCollinear(points: ProfilePoint[], tolMm = 0.001): ProfilePoint[] {
  if (points.length <= 2) return points
  const result: ProfilePoint[] = [points[0]]
  let lastKept = points[0]
  for (let index = 1; index < points.length - 1; index++) {
    const cur = points[index]
    const next = points[index + 1]
    const dy = next.y - lastKept.y
    const dr = next.radius - lastKept.radius
    const len = Math.hypot(dy, dr)
    if (len === 0) continue
    const dist = Math.abs((cur.y - lastKept.y) * dr - (cur.radius - lastKept.radius) * dy) / len
    if (dist >= tolMm) {
      result.push(cur)
      lastKept = cur
    }
  }
  result.push(points[points.length - 1])
  return result
}

function extractBladeEnvelopeProfile(program: Program, calibration: GeometryCalibration, bladeWidthMm: number): Profile {
  const half = bladeWidthMm / 2
  let minY = Infinity
  let maxY = -Infinity

  for (const sweep of program.sweeps) {
    for (const point of sweep.points) {
      if (point.y - half < minY) minY = point.y - half
      if (point.y + half > maxY) maxY = point.y + half
    }
  }

  if (!Number.isFinite(minY) || !Number.isFinite(maxY) || !(maxY > minY)) {
    throw new AnalysisError('noProfile')
  }

  const sampleResolutionMm = 0.05
  minY = Math.floor(minY)
  maxY = Math.ceil(maxY)
  const numSamples = Math.ceil((maxY - minY) / sampleResolutionMm) + 1
  const radiusArr = new Float64Array(numSamples).fill(Infinity)
  const lineArr = new Int32Array(numSamples).fill(0)

  for (const sweep of program.sweeps) {
    const pts = sweep.points
    for (let index = 1; index < pts.length; index++) {
      const p1 = pts[index - 1]
      const p2 = pts[index]
      const r1 = p1.z * calibration.radiusScale + calibration.radiusOffsetMm
      const r2 = p2.z * calibration.radiusScale + calibration.radiusOffsetMm

      if (!Number.isFinite(r1) || r1 < 0 || !Number.isFinite(r2) || r2 < 0) {
        throw new AnalysisError('invalidRadius')
      }

      const yMinSeg = Math.min(p1.y, p2.y) - half
      const yMaxSeg = Math.max(p1.y, p2.y) + half
      const startIdx = Math.max(0, Math.floor((yMinSeg - minY) / sampleResolutionMm))
      const endIdx = Math.min(numSamples - 1, Math.ceil((yMaxSeg - minY) / sampleResolutionMm))

      const dy = p2.y - p1.y
      const dr = r2 - r1

      for (let idx = startIdx; idx <= endIdx; idx++) {
        const yCur = minY + idx * sampleResolutionMm
        const cMin = Math.max(Math.min(p1.y, p2.y), yCur - half)
        const cMax = Math.min(Math.max(p1.y, p2.y), yCur + half)

        if (cMin <= cMax) {
          let zLow: number
          if (Math.abs(dy) < 1e-9) {
            zLow = Math.min(r1, r2)
          } else {
            const zAtCMin = r1 + dr * ((cMin - p1.y) / dy)
            const zAtCMax = r1 + dr * ((cMax - p1.y) / dy)
            zLow = Math.min(zAtCMin, zAtCMax)
          }

          if (zLow < radiusArr[idx]) {
            radiusArr[idx] = zLow
            lineArr[idx] = p2.line
          }
        }
      }
    }
  }

  const rawPoints: ProfilePoint[] = []
  for (let idx = 0; idx < numSamples; idx++) {
    const radius = radiusArr[idx]
    if (Number.isFinite(radius)) {
      rawPoints.push({
        y: minY + idx * sampleResolutionMm,
        radius,
        line: lineArr[idx],
      })
    }
  }

  if (rawPoints.length < 5) {
    throw new AnalysisError('noProfile')
  }

  const points = simplifyCollinear(rawPoints, 0.001)

  return {
    points,
    range: { low: points[0].y, high: points.at(-1)!.y },
    sourceLines: {
      start: program.sweeps[0]?.points[0]?.line ?? 1,
      end: program.sweeps.at(-1)?.points.at(-1)?.line ?? 1,
    },
    sweepCount: program.sweeps.length,
  }
}

export function extractProfile(program: Program, calibration: GeometryCalibration, bladeWidthMm = 0): Profile {
  const maximumSpan = program.sweeps.reduce((maximum, sweep) => Math.max(maximum, sweep.span), 0)
  if (!(maximumSpan > 0)) throw new AnalysisError('noProfile')

  if (bladeWidthMm > 0) {
    return extractBladeEnvelopeProfile(program, calibration, bladeWidthMm)
  }

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
