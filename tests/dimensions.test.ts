import { describe, expect, it } from 'vitest'
import { gripParameters } from '../src/config/analysis'
import { clipProfile } from '../src/domain/geometry/volume'
import { measureDimensions } from '../src/domain/geometry/dimensions'
import { detectGripRegion } from '../src/domain/grip/registry'
import type { GripStrategy, ProfilePoint } from '../src/domain/types'

const point = (y: number, radius: number): ProfilePoint => ({ y, radius, line: 1 })
const shape = [point(0, 0), point(10, 30), point(100, 32), point(300, 30), point(500, 20), point(650, 13), point(720, 11), point(770, 12), point(820, 15), point(840, 24), point(850, 22), point(870, 0)]
const context = { parameters: gripParameters }

describe('dimensions of the retained bat', () => {
  it('uses the cut coordinates and interpolated radii, including a removed maximum', () => {
    const retained = clipProfile([point(0, 40), point(100, 20), point(200, 10)], { low: 50, high: 150 })
    const measured = measureDimensions(retained, context)
    expect(measured.lengthMm).toBe(100)
    expect(measured.maximumDiameterMm).toBe(60)
    expect(measured.maximum).toMatchObject({ y: 50, radius: 30 })
    expect(measured.grip.status).toBe('undetermined')
  })
  it('excludes the end caps and knob when finding the minimum grip diameter', () => {
    const measured = measureDimensions(shape, context)
    expect(measured).toMatchObject({ lengthMm: 870, maximumDiameterMm: 64, grip: { status: 'detected', diameterMm: 22, end: 'high', minimum: { y: 720 } } })
    if (measured.grip.status !== 'detected') return
    expect(measured.grip.region.low).toBeLessThan(720)
    expect(measured.grip.region.high).toBeGreaterThan(720)
    expect(measured.grip.region.high).toBeLessThan(840)
  })
  it('recognizes the grip at the opposite coordinate end', () => {
    const reversed = [...shape].reverse().map(p => ({ ...p, y: 870 - p.y }))
    expect(measureDimensions(reversed, context).grip).toMatchObject({ status: 'detected', diameterMm: 22, end: 'low', minimum: { y: 150 } })
  })
  it('gives the same result after adding points to linear segments', () => {
    const dense = shape.flatMap((p, index) => index === 0 ? [p] : [point((shape[index - 1].y + p.y) / 2, (shape[index - 1].radius + p.radius) / 2), p])
    const sparse = measureDimensions(shape, context), measured = measureDimensions(dense, context)
    expect(measured).toEqual(sparse)
  })
  it('keeps length and maximum diameter when grip orientation is ambiguous', () => {
    const cylinder = Array.from({ length: 11 }, (_, index) => point(index * 100, 20))
    expect(measureDimensions(cylinder, context)).toMatchObject({ lengthMm: 1000, maximumDiameterMm: 40, grip: { status: 'undetermined', code: 'ambiguousGripEnd' } })
  })
  it('does not identify a monotone taper as a grip valley', () => {
    const taper = Array.from({ length: 11 }, (_, index) => point(index * 100, 32 - 2.2 * index))
    expect(measureDimensions(taper, context).grip.status).toBe('undetermined')
  })
  it('does not reuse a minimum that has been cut away', () => {
    const retained = clipProfile(shape, { low: 0, high: 650 })
    expect(measureDimensions(retained, context).grip.status).toBe('undetermined')
  })
  it('rejects a further deeper waist toward the barrel', () => {
    const unusual = shape.map(p => p.y === 500 ? { ...p, radius: 8 } : p)
    expect(measureDimensions(unusual, context).grip.status).toBe('undetermined')
  })
  it('rejects a deeper waist outside the handle search range', () => {
    const unusual = [...shape, point(450, 8)].sort((a, b) => a.y - b.y)
    expect(measureDimensions(unusual, context).grip.status).toBe('undetermined')
  })
  it('reports disagreement between future grip strategies', () => {
    const strategy = (id: string, low: number): GripStrategy => ({ id, version: '1', applicable: () => true, detect: () => ({ status: 'detected', end: 'high', region: { low, high: 800 } }) })
    expect(detectGripRegion(shape, context, [strategy('a', 600), strategy('b', 620)]).decision).toMatchObject({ status: 'undetermined', code: 'gripStrategiesDisagree' })
  })
})
