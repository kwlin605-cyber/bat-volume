import { describe, expect, it } from 'vitest'
import { clipProfile, integrateVolumeMm3 } from '../src/domain/geometry/volume'
import type { ProfilePoint } from '../src/domain/types'

const point = (y: number, radius: number): ProfilePoint => ({ y, radius, line: 1 })

describe('retained volume', () => {
  it('integrates a cylinder after cutting both ends', () => {
    const retained = clipProfile([point(0, 20), point(1000, 20)], { low: 50, high: 850 })
    expect(retained.map(p => p.y)).toEqual([50, 850])
    expect(integrateVolumeMm3(retained)).toBeCloseTo(Math.PI * 20 ** 2 * 800, 7)
  })
  it('interpolates cut radii and exactly integrates a conical segment', () => {
    const retained = clipProfile([point(0, 0), point(100, 10)], { low: 20, high: 80 })
    expect(retained.map(p => p.radius)).toEqual([2, 8])
    // Integral of pi*(y/10)^2 between y=20 and y=80.
    const expected = Math.PI * (80 ** 3 - 20 ** 3) / 300
    expect(integrateVolumeMm3(retained)).toBeCloseTo(expected, 9)
  })
  it('does not add volume for radial changes at the same axial coordinate', () => {
    const points = [point(0, 10), point(10, 10), point(10, 20), point(20, 20)]
    expect(integrateVolumeMm3(points)).toBeCloseTo(Math.PI * (100 * 10 + 400 * 10), 9)
  })
  it('rejects cuts outside the source profile', () => {
    expect(() => clipProfile([point(0, 10), point(100, 10)], { low: -1, high: 80 })).toThrow()
    expect(() => clipProfile([point(0, 10), point(100, 10)], { low: 80, high: 20 })).toThrow()
  })
})
