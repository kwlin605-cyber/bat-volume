import { clipProfile } from '../geometry/volume'
import type { GripStrategy, ProfilePoint } from '../types'

// Integrating by axial distance avoids bias from the different point spacing
// of dense finishing files and sparse roughing files.
function meanRadius(points: readonly ProfilePoint[], low: number, high: number): number {
  const band = clipProfile([...points], { low, high })
  let integral = 0
  for (let index = 1; index < band.length; index++) {
    integral += (band[index].y - band[index - 1].y) * (band[index].radius + band[index - 1].radius) / 2
  }
  return integral / (high - low)
}

type OrientedPoint = ProfilePoint & { distance: number }
function crossing(a: OrientedPoint, b: OrientedPoint, radius: number): number {
  return a.y + (b.y - a.y) * (radius - a.radius) / (b.radius - a.radius)
}

export const knobValleyStrategy: GripStrategy = {
  id: 'narrow-end-knob-valley',
  version: '1.0.0',
  applicable: points => points.length >= 7 && points.at(-1)!.y > points[0].y,
  detect(points, { parameters: p }) {
    const low = points[0].y, high = points.at(-1)!.y, length = high - low
    const lowMean = meanRadius(points, low + length * p.endBand.startFraction, low + length * p.endBand.endFraction)
    const highMean = meanRadius(points, high - length * p.endBand.endFraction, high - length * p.endBand.startFraction)
    if (!(Math.max(lowMean, highMean) >= Math.min(lowMean, highMean) * p.minimumEndRadiusRatio) || Math.min(lowMean, highMean) <= 0) {
      return { status: 'undetermined', code: 'ambiguousGripEnd' }
    }
    const end = lowMean < highMean ? 'low' : 'high'
    const ordered = end === 'low' ? [...points] : [...points].reverse()
    const sequence: OrientedPoint[] = ordered.map(point => ({ ...point, distance: end === 'low' ? point.y - low : high - point.y }))
    const knobLimit = length * p.knobSearchFraction
    const knob = sequence.filter(point => point.distance <= knobLimit).reduce((a, b) => b.radius > a.radius ? b : a)
    if (knob.distance <= p.coordinateToleranceMm || knob.distance >= knobLimit - p.coordinateToleranceMm || knob.radius - sequence[0].radius < p.minimumKnobRiseMm) {
      return { status: 'undetermined', code: 'missingGripKnob' }
    }
    const searchLimit = length * p.minimumSearchFraction
    const search = sequence.filter(point => point.distance > knob.distance && point.distance < searchLimit)
    if (!search.length) return { status: 'undetermined', code: 'unboundedGripMinimum' }
    const minimum = search.reduce((a, b) => b.radius < a.radius ? b : a)
    const margin = length * p.minimumInteriorFraction
    const recoveryY = end === 'low' ? low + searchLimit : high - searchLimit
    const recovery = clipProfile([...points], { low: end === 'low' ? minimum.y : recoveryY, high: end === 'low' ? recoveryY : minimum.y })
    const recoveryRadius = end === 'low' ? recovery.at(-1)!.radius : recovery[0].radius
    const barrelLimit = length * (1 - p.endBand.endFraction)
    const laterMinimum = sequence.some(point => point.distance > minimum.distance && point.distance < barrelLimit && point.radius < minimum.radius - p.coordinateToleranceMm)
    let precedingFloor = Infinity
    const earlierValley = sequence.some(point => {
      if (point.distance <= knob.distance || point.distance >= minimum.distance) return false
      precedingFloor = Math.min(precedingFloor, point.radius)
      return point.radius > precedingFloor + p.minimumRecoveryMm
    })
    if (minimum.distance < knob.distance + margin || minimum.distance > searchLimit - margin ||
        minimum.radius > knob.radius * (1 - p.minimumKnobDropRatio) ||
        recoveryRadius < minimum.radius + p.minimumRecoveryMm || laterMinimum || earlierValley) {
      return { status: 'undetermined', code: 'unboundedGripMinimum' }
    }
    // A radius contour around the valley excludes both the knob and the
    // widening barrel. Its interpolated crossings define a semantic region;
    // physical cut positions remain exclusively owned by the cut strategy.
    const threshold = minimum.radius + (knob.radius - minimum.radius) * p.regionRadiusFraction
    let start: number | undefined, finish: number | undefined
    for (let index = 1; index < sequence.length; index++) {
      const a = sequence[index - 1], b = sequence[index]
      if (a.distance >= knob.distance && b.distance <= minimum.distance && a.radius >= threshold && b.radius < threshold) start = crossing(a, b, threshold)
      if (a.distance >= minimum.distance && b.distance <= barrelLimit && a.radius < threshold && b.radius >= threshold) { finish = crossing(a, b, threshold); break }
    }
    if (start === undefined || finish === undefined || start === finish) return { status: 'undetermined', code: 'unboundedGripMinimum' }
    return { status: 'detected', end, region: { low: Math.min(start, finish), high: Math.max(start, finish) } }
  },
}
