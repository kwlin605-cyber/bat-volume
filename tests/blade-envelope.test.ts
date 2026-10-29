import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { calibration, gripParameters, ruleParameters } from '../src/config/analysis'
import { extractProfile } from '../src/domain/anc/profile'
import { analyzeAnc } from '../src/domain/analyze'
import { clipProfile, integrateVolumeMm3 } from '../src/domain/geometry/volume'
import type { Program } from '../src/domain/types'
import { buildBatchView } from '../src/features/batch/view-model'

function program(...passes: [number, number][][]): Program {
  let line = 0
  return {
    lineCount: passes.reduce((n, pass) => n + pass.length, 0),
    sweeps: passes.map(pass => ({
      points: pass.map(([y, z]) => ({ x: 0, y, z, line: ++line, hasY: true })),
      span: Math.max(...pass.map(p => p[0])) - Math.min(...pass.map(p => p[0])),
    })),
  }
}

describe('continuous flat-blade envelope', () => {
  it.each([1, 5])('preserves fractional endpoints and the exact taper volume, width %s', width => {
    const low = 0.017, high = 10.023
    const profile = extractProfile(program([[low, 10], [high, 14]]), calibration, width)
    expect(profile.points.map(({ y, radius }) => [y, radius])).toEqual([
      [low - width / 2, 10], [low + width / 2, 10], [high + width / 2, 14],
    ])
    const expected = Math.PI * (width * 100 + (high - low) * (100 + 140 + 196) / 3)
    expect(integrateVolumeMm3(profile.points)).toBeCloseTo(expected, 8)
  })

  it('retains a peak where two swept slopes intersect between scan stations', () => {
    const profile = extractProfile(program([[0, 10], [5.017, 20], [10, 10]]), calibration, 1)
    const peak = profile.points.reduce((a, b) => a.radius > b.radius ? a : b)
    expect(peak.y).toBeCloseTo(5.0153, 10)
    expect(peak.radius).toBeCloseTo(19, 10)
    expect(integrateVolumeMm3(profile.points)).toBeCloseTo(Math.PI * 2153, 8)
  })

  it('preserves both edges of a shallow valley without flattening its surrounding curves', () => {
    const pass: [number, number][] = Array.from({ length: 101 }, (_, y) => [y, 10 + (y - 50) ** 2 / 1000])
    const profile = extractProfile(program(pass), calibration, 5)
    const valley = clipProfile(profile.points, { low: 47.5, high: 52.5 })
    expect(valley.every(p => p.radius === 10)).toBe(true)
    for (const y of [0.123, 20.017, 40.027, 47.5, 50, 52.5, 60.013, 80.021, 100.019]) {
      const center = Math.max(0, Math.min(100, Math.max(y - 2.5, Math.min(50, y + 2.5))))
      const lo = Math.floor(center), hi = Math.min(100, lo + 1)
      const r0 = 10 + (lo - 50) ** 2 / 1000, r1 = 10 + (hi - 50) ** 2 / 1000
      const expected = r0 + (r1 - r0) * (center - lo)
      expect(clipProfile(profile.points, { low: y, high: y + 0.001 })[0].radius).toBeCloseTo(expected, 10)
    }
  })

  it('unions passes without subtracting overlapping or repeated cuts twice', () => {
    const coarse: [number, number][] = [[0, 25], [50, 25], [100, 25]]
    const fine: [number, number][] = [[20, 15], [30, 15], [40, 15]]
    const profile = extractProfile(program(coarse, fine), calibration, 5)
    const repeated = extractProfile(program(fine, coarse, fine, coarse), calibration, 5)
    const expected = Math.PI * (625 * 105 - (625 - 225) * 25)
    expect(integrateVolumeMm3(profile.points)).toBeCloseTo(expected, 8)
    expect(integrateVolumeMm3(repeated.points)).toBeCloseTo(expected, 8)
    expect(profile.points.filter(p => p.y === 17.5).map(p => p.radius)).toEqual([25, 15])
    expect(profile.points.filter(p => p.y === 42.5).map(p => p.radius)).toEqual([15, 25])
    const retained = clipProfile(profile.points, { low: 17.5, high: 42.5 })
    expect(retained.every(p => p.radius === 15)).toBe(true)
    expect(integrateVolumeMm3(retained)).toBeCloseTo(Math.PI * 225 * 25, 8)
  })

  it('preserves the same envelope when a pass is traversed backwards', () => {
    const forward: [number, number][] = [[0.017, 12], [5.123, 10], [10.029, 13]]
    const a = extractProfile(program(forward), calibration, 5)
    const b = extractProfile(program([...forward].reverse()), calibration, 5)
    expect(a.range).toEqual(b.range)
    for (const y of [0, 2.623, 5, 7.623, 10]) {
      expect(clipProfile(a.points, { low: y, high: y + 0.001 })[0].radius)
        .toBeCloseTo(clipProfile(b.points, { low: y, high: y + 0.001 })[0].radius, 10)
    }
  })

  it('does not invent a surface between disconnected cutting passes', () => {
    expect(() => extractProfile(program([[0, 10], [10, 10]], [[80, 10], [100, 10]]), calibration, 5)).toThrow()
  })

  it('applies radius calibration before combining cutting passes', () => {
    const input = program([[0, 10], [10, 14]])
    const profile = extractProfile(input, { ...calibration, radiusScale: 2, radiusOffsetMm: 1 }, 5)
    expect(profile.points.map(p => p.radius)).toEqual([21, 21, 29])
  })
})

describe('full envelope shared by dimensions and weight calculations', () => {
  it.each([
    ['劉/X-56-860.anc', 7.93, 867.59],
    ['na/243.anc', 6.97, 852.37],
    ['星裕/730M2.anc', 7.39, 860.13],
  ] as const)('uses the off-grid blade boundary at both ends of %s', (file, low, high) => {
    const text = readFileSync(new URL(`../src/assets/anc/${file}`, import.meta.url), 'utf8')
    const result = analyzeAnc(text, { name: file, size: text.length }, undefined, undefined, 5)
    if (result.status !== 'calculated') throw new Error('Expected a calculated bat')
    expect(result.cuts.low).toBeCloseTo(low, 10)
    expect(result.cuts.high).toBeCloseTo(high, 10)
    expect(result.dimensions.lengthMm).toBeCloseTo(high - low, 10)
  })

  it.each([0, 3.175, 5])('keeps exact boundaries when the blade width is %s', width => {
    const text = 'G90 G0 X0 Y100 Z30\nG1 Z10\nY95.123\nY80 Z20\nY20\nY5.017 Z10\nY0\nM30'
    const result = analyzeAnc(text, { name: 'fractional.anc', size: text.length }, undefined, undefined, width)
    if (result.status !== 'calculated') throw new Error('Expected a calculated bat')
    expect(result.cuts.low).toBeCloseTo(5.017 + width / 2, 10)
    expect(result.cuts.high).toBeCloseTo(95.123 - width / 2, 10)
  })

  it('cuts at the inward rise beyond the narrowing outer step of 318-V2', () => {
    const text = readFileSync(new URL('../src/assets/anc/拿/318-V2.anc', import.meta.url), 'utf8')
    const result = analyzeAnc(text, { name: '318-V2.anc', size: text.length }, undefined, undefined, 5)
    expect(result.status).toBe('calculated')
    if (result.status !== 'calculated') throw new Error('Expected a calculated bat')
    expect(result.cuts.low).toBeCloseTo(7.5, 10)
    expect(result.cuts.high).toBeCloseTo(855.5, 10)
    expect(result.dimensions.lengthMm).toBeCloseTo(848, 10)
    expect(result.rule).toMatchObject({ strategy: 'terminal-first-rise', version: '1.0.0' })
  })

  it('keeps the real WT320.33 handle valley at 21.8 mm', () => {
    const text = readFileSync(new URL('../src/assets/anc/劉/WT320.33.anc', import.meta.url), 'utf8')
    const result = analyzeAnc(text, { name: 'WT320.33.anc', size: text.length }, undefined, undefined, 5)
    expect(result.status).toBe('calculated')
    if (result.status !== 'calculated') throw new Error('Expected a calculated bat')
    expect(result.dimensions.grip.status).toBe('detected')
    if (result.dimensions.grip.status !== 'detected') throw new Error('Expected a detected handle')
    expect(result.dimensions.grip.diameterMm).toBeCloseTo(21.8, 10)
    expect(clipProfile(result.retained, { low: 621.1, high: 621.101 })[0].radius).toBeCloseTo(11.266736842105262, 10)
  })

  it('uses the exact clipped shape for volume, diameters, estimates and inverse material weights', () => {
    const text = 'G90 G0 X0 Y100 Z30\nG1 Z10\nY95\nY94 Z12\nY6 Z20\nY5 Z10\nY0\nG0 Z30\nM30'
    const result = analyzeAnc(text, { name: 'taper.anc', size: text.length }, { calibration, parameters: ruleParameters }, { parameters: gripParameters }, 5)
    expect(result.status).toBe('calculated')
    if (result.status !== 'calculated') throw new Error('Expected a calculated taper')
    expect(result.cuts).toEqual({ low: 7.5, high: 92.5 })
    const peakY = 938.5 / 111, peakR = 10 * peakY - 65
    const linearIntegral = (m: number, b: number, lo: number, hi: number) =>
      ((m * hi + b) ** 3 - (m * lo + b) ** 3) / (3 * m)
    const expectedVolume = Math.PI * (linearIntegral(10, -65, 7.5, peakY)
      + linearIntegral(-1 / 11, 223.5 / 11, peakY, 91.5)
      + linearIntegral(-2, 195, 91.5, 92.5)) / 1000
    expect(result.volumeCm3).toBeCloseTo(expectedVolume, 9)
    expect(result.dimensions.maximumDiameterMm).toBeCloseTo(peakR * 2, 10)
    expect(result.dimensions.lengthMm).toBe(85)
    const entries = [{ id: 'bat', source: result.source, state: { status: 'result' as const, result } }]
    const material = { referenceDensity: 0.7, volumeCm3: 3000, weightG: null, weightErrorPercent: -3 }
    const estimated = buildBatchView(entries, ['volume', 'maximumDiameter', 'batWeight'], { key: 'name', direction: 'asc' }, { material, requirements: {} })
    expect(estimated.rows[0].cells.volume.value).toBe(result.volumeCm3)
    expect(estimated.rows[0].cells.maximumDiameter.value).toBe(result.dimensions.maximumDiameterMm)
    expect(estimated.rows[0].cells.batWeight.value).toBeCloseTo(expectedVolume * 0.7 * 0.97, 9)
    const required = buildBatchView(entries, ['materialWeight'], { key: 'name', direction: 'asc' }, {
      material, requirements: { bat: { min: 800, max: 850 } }, weightUnit: 'g',
    })
    expect(required.rows[0].cells.materialWeight.value).toBeCloseTo(800 * 3000 / expectedVolume / 0.97, 7)
    expect(required.rows[0].cells.materialWeight.maximum).toBeCloseTo(850 * 3000 / expectedVolume / 0.97, 7)
  })
})
