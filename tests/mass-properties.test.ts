import { describe, expect, it } from 'vitest'
import { calculateMassProperties } from '../src/domain/geometry/mass-properties'
import { calculateBatProperties } from '../src/domain/bat-properties'
import { analyzeAnc } from '../src/domain/analyze'
import { inertiaFromKgM2 } from '../src/domain/mass-property-units'
import { formatBalancePoint, formatInertia } from '../src/lib/mass-property-display'
import { gramsPerOunce } from '../src/domain/weight-unit'
import { readMassPropertyUnits, saveMassPropertyUnits } from '../src/services/mass-property-unit-storage'
import type { ProfilePoint } from '../src/domain/types'

const point = (y: number, radius: number): ProfilePoint => ({ y, radius, line: 1 })
const material = { referenceDensity: 0.7, volumeCm3: 3000, weightG: null, weightErrorPercent: -3 }

describe('uniform solid mass properties', () => {
  it('matches an analytical transverse cylinder, including its radius', () => {
    const shape = calculateMassProperties([point(0, 30), point(900, 30)], 'low')
    expect(shape.balancePointMm).toBeCloseTo(450, 10)
    expect(shape.inertiaPerMassMm2).toBeCloseTo(900 ** 2 / 12 + 30 ** 2 / 4 + (450 - 152.4) ** 2, 8)
  })
  it('matches a cone and is unchanged by segmentation', () => {
    const a = calculateMassProperties([point(0, 0), point(900, 30)], 'low')
    const b = calculateMassProperties([point(0, 0), point(225, 7.5), point(450, 15), point(900, 30)], 'low')
    expect(a.balancePointMm).toBeCloseTo(675, 10)
    expect(a.inertiaPerMassMm2).toBeCloseTo(3 * 900 ** 2 / 80 + 3 * 30 ** 2 / 20 + (675 - 152.4) ** 2, 8)
    expect(b.inertiaPerMassMm2).toBeCloseTo(a.inertiaPerMassMm2!, 8)
  })
  it('is invariant under coordinate translation and reversal with the knob end reversed', () => {
    const a = calculateMassProperties([point(0, 10), point(300, 10), point(900, 30)], 'low')
    const b = calculateMassProperties([point(100000, 30), point(100600, 10), point(100900, 10)], 'high')
    expect(b.balancePointMm).toBeCloseTo(a.balancePointMm!, 8)
    expect(b.inertiaPerMassMm2).toBeCloseTo(a.inertiaPerMassMm2!, 7)
  })
  it('preserves a geometric center when the knob end is unknown', () => {
    const value = calculateMassProperties([point(20, 10), point(820, 10)], null)
    expect(value.center.y).toBeCloseTo(420, 10)
    expect(value.balancePointMm).toBeNull()
    expect(value.inertiaPerMassMm2).toBeNull()
  })
})

describe('shared bat weight and MOI', () => {
  const source = 'G90 G0 X0 Y100 Z30\nG1 Z10\nY95\nY94 Z12\nY6 Z20\nY5 Z10\nY0\nM30'
  const result = analyzeAnc(source, { name: 'sample.anc', size: source.length })
  // A deterministic known orientation isolates the weight contract from grip detection.
  if (result.status !== 'calculated') throw new Error('Expected calculated fixture')
  result.massProperties = calculateMassProperties(result.retained, 'low')

  it('uses corrected estimated mass and target ranges without applying correction twice', () => {
    const estimated = calculateBatProperties(result, material, null)
    expect(estimated.weightG?.min).toBeCloseTo(result.volumeCm3 * 0.7 * 0.97, 10)
    const target = calculateBatProperties(result, material, { min: 800, max: 1000 })
    expect(target.weightG).toEqual({ min: 800, max: 1000 })
    expect(target.moiKgM2!.max / target.moiKgM2!.min).toBeCloseTo(1.25, 12)
    expect(target.balancePointMm).toBe(estimated.balancePointMm)
  })
  it('retains balance and the center marker without mass; specified mass needs no density', () => {
    const empty = { referenceDensity: null, volumeCm3: null, weightG: null, weightErrorPercent: null }
    const missing = calculateBatProperties(result, empty, null)
    expect(missing.center).not.toBeNull()
    expect(missing.balancePointMm).not.toBeNull()
    expect(missing.weightG).toBeNull()
    expect(missing.moiKgM2).toBeNull()
    expect(calculateBatProperties(result, empty, { min: 800, max: 800 }).moiKgM2).not.toBeNull()
  })
})

describe('mass property units and display precision', () => {
  it('converts mass-length-squared units and rounds only for presentation', () => {
    expect(inertiaFromKgM2(0.2, 'kg-cm2')).toBe(2000)
    const oneOunceInchSquared = gramsPerOunce / 1000 * 0.0254 ** 2
    expect(inertiaFromKgM2(oneOunceInchSquared, 'oz-in2')).toBeCloseTo(1, 12)
    expect(formatBalancePoint(523.46, 'cm')).toBe('52.3')
    expect(formatBalancePoint(523.46, 'in')).toBe('20.6')
    expect(formatInertia(0.200055, 'kg-cm2')).toBe('2,001')
  })
  it('defaults to metric, saves units independently of batches, and handles blocked storage', () => {
    const values = new Map<string, string>()
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
    expect(readMassPropertyUnits(storage).units).toEqual({ balance: 'cm', inertia: 'kg-cm2' })
    expect(saveMassPropertyUnits(storage, { balance: 'in', inertia: 'oz-in2' })).toBe(true)
    expect(readMassPropertyUnits(storage).units).toEqual({ balance: 'in', inertia: 'oz-in2' })
    const blocked = { getItem: (): never => { throw new Error('blocked') }, setItem: (): never => { throw new Error('blocked') } }
    expect(readMassPropertyUnits(blocked).unavailable).toBe(true)
    expect(saveMassPropertyUnits(blocked, { balance: 'cm', inertia: 'kg-cm2' })).toBe(false)
  })
})
