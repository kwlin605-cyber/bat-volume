import { describe, expect, it } from 'vitest'
import { profilePointAt, sampleProfile } from '../src/domain/geometry/profile'
import { clipProfile, integrateVolumeMm3 } from '../src/domain/geometry/volume'
import { detectCuts } from '../src/domain/cuts/registry'
import { bladeGeometrySettings, calibration, ruleParameters } from '../src/config/analysis'
import type { Profile } from '../src/domain/types'

const profile: Profile = {
  points: [[-0.017, 10], [5, 10], [5, 20], [95, 20], [95, 10], [100.017, 10]]
    .map(([y, radius], line) => ({ y, radius, line: line + 1 })),
  range: { low: -0.017, high: 100.017 }, sourceLines: { start: 1, end: 6 }, sweepCount: 2,
}

describe('full profile interpolation and legacy cut sampling', () => {
  it('distinguishes the two sides of a step and the deepest radius at its boundary', () => {
    expect(profilePointAt(profile.points, 5, 'left').radius).toBe(10)
    expect(profilePointAt(profile.points, 5, 'right').radius).toBe(20)
    expect(profilePointAt(profile.points, 5).radius).toBe(10)
    expect(profilePointAt(profile.points, 95, 'left').radius).toBe(20)
    expect(profilePointAt(profile.points, 95, 'right').radius).toBe(10)
    expect(profilePointAt(profile.points, 95).radius).toBe(10)
    expect(profilePointAt(profile.points, 50).radius).toBe(20)
  })

  it('clips exactly at vertical steps without keeping the discarded side in its dimensions', () => {
    const retained = clipProfile(profile.points, { low: 5, high: 95 })
    expect(retained.map(p => [p.y, p.radius])).toEqual([[5, 20], [95, 20]])
    expect(integrateVolumeMm3(retained)).toBeCloseTo(Math.PI * 400 * 90, 8)
  })

  it('keeps scan spacing and cut rules while leaving the complete source untouched', () => {
    const original = structuredClone(profile)
    const scanned = sampleProfile(profile, bladeGeometrySettings.cutSampleSpacingMm)
    expect(scanned.points).toHaveLength(2001)
    expect(scanned.range).toEqual({ low: 0, high: 100 })
    expect(scanned.points[100]).toMatchObject({ y: 5, radius: 10 })
    const { decision } = detectCuts(scanned, { calibration, parameters: ruleParameters })
    expect(decision).toMatchObject({ status: 'detected', cuts: { low: 5, high: 95 } })
    expect(profile).toEqual(original)
    expect(profile.range.low).toBe(-0.017)
    expect(profile.range.high).toBe(100.017)
  })

  it('rejects invalid scan spacings and coordinates outside the known shape', () => {
    for (const spacing of [0, -1, NaN, Infinity]) expect(() => sampleProfile(profile, spacing)).toThrow()
    for (const y of [-1, 101]) expect(() => profilePointAt(profile.points, y)).toThrow()
  })
})
