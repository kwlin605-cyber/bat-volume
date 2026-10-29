import { describe, expect, it } from 'vitest'
import { gripParameters } from '../src/config/analysis'
import { measureDimensions } from '../src/domain/geometry/dimensions'
import { clipProfile } from '../src/domain/geometry/volume'
import type { ProfilePoint } from '../src/domain/types'

const point = (y: number, radius: number): ProfilePoint => ({ y, radius, line: 1 })
const shape = [point(0, 0), point(10, 30), point(100.237, 32), point(300, 30), point(500, 20), point(650, 13), point(720.456, 11), point(770, 12), point(820, 15), point(840, 24), point(850, 22), point(870, 0)]
const context = { parameters: gripParameters }

describe('distances measured from the retained head and butt faces', () => {
  it('keeps full millimetre precision and measures from opposite ends', () => {
    const dimensions = measureDimensions(shape, context)
    expect(dimensions.distances?.head).toEqual([{ startMm: 100.237, endMm: 100.237 }])
    expect(dimensions.distances?.grip[0].startMm).toBeCloseTo(870 - 720.456, 10)
    expect(dimensions.distances?.grip[0].endMm).toBeCloseTo(870 - 720.456, 10)
    expect(dimensions.maximumDiameterMm).toBe(64)
    expect(dimensions.grip).toMatchObject({ status: 'detected', diameterMm: 22 })
  })

  it('keeps the same measurement direction when the ANC axes are reversed or translated', () => {
    const expected = measureDimensions(shape, context).distances!
    for (const points of [shape.map(p => ({ ...p, y: p.y + 1234.56789 })), [...shape].reverse().map(p => ({ ...p, y: 870 - p.y }))]) {
      const measured = measureDimensions(points, context).distances!
      for (const key of ['head', 'grip'] as const) {
        expect(measured[key]).toHaveLength(expected[key].length)
        measured[key].forEach((range, index) => {
          expect(range.startMm).toBeCloseTo(expected[key][index].startMm, 9)
          expect(range.endMm).toBeCloseTo(expected[key][index].endMm, 9)
        })
      }
    }
  })

  it('returns continuous flat regions, including their non-grid boundaries', () => {
    const plateau = shape.flatMap(p => p.y === 100.237 ? [point(80.1234, 32), point(120.4567, 32)]
      : p.y === 720.456 ? [point(700.3456, 11), point(740.6789, 11)] : [p])
    const measured = measureDimensions(plateau, context)
    expect(measured.distances?.head).toEqual([{ startMm: 80.1234, endMm: 120.4567 }])
    expect(measured.distances?.grip[0].startMm).toBeCloseTo(870 - 740.6789, 10)
    expect(measured.distances?.grip[0].endMm).toBeCloseTo(870 - 700.3456, 10)
    const dense = plateau.flatMap((p, index) => index === 0 ? [p] : [point((plateau[index - 1].y + p.y) / 2, (plateau[index - 1].radius + p.radius) / 2), p])
    expect(measureDimensions(dense, context).distances).toEqual(measured.distances)
  })

  it('does not join separate equal-diameter regions across a narrower section', () => {
    const separated = [...shape, point(180, 31), point(200, 32), point(220, 31)].sort((a, b) => a.y - b.y)
    expect(measureDimensions(separated, context).distances?.head).toEqual([
      { startMm: 100.237, endMm: 100.237 }, { startMm: 200, endMm: 200 },
    ])
  })

  it('does not turn a small real slope into an equal-diameter range', () => {
    const slope = [...shape, point(100.1, 32 - 0.000001)].sort((a, b) => a.y - b.y)
    expect(measureDimensions(slope, context).distances?.head).toEqual([{ startMm: 100.237, endMm: 100.237 }])
  })

  it('uses the retained cut faces instead of the full profile extents', () => {
    const retained = clipProfile(shape, { low: 5.123, high: 865.789 })
    const measured = measureDimensions(retained, context)
    expect(measured.distances?.head[0].startMm).toBeCloseTo(100.237 - 5.123, 10)
    expect(measured.distances?.grip[0].startMm).toBeCloseTo(865.789 - 720.456, 10)
  })

  it('retains the diameter but leaves distances unknown when head and butt cannot be identified', () => {
    const cylinder = Array.from({ length: 11 }, (_, index) => point(index * 100, 20))
    expect(measureDimensions(cylinder, context)).toMatchObject({ maximumDiameterMm: 40, distances: null })
  })

  it('shows an extremum at a cut face as positive zero when measuring inward from the high coordinate end', () => {
    const faceMaximum = shape.map((p, index) => index === 0 ? { ...p, radius: 32 } : p)
    const reversed = [...faceMaximum].reverse().map(p => ({ ...p, y: 870 - p.y }))
    expect(measureDimensions(reversed, context).distances?.head[0].startMm).toBe(0)
  })

  it('preserves the correct side of vertical steps at the ends of an equal-diameter region', () => {
    const steps = shape.flatMap(p => p.y === 100.237 ? [point(90, 31), point(90, 32), point(120, 32), point(120, 31)] : [p])
    expect(measureDimensions(steps, context).distances?.head).toEqual([{ startMm: 90, endMm: 120 }])
  })
})
