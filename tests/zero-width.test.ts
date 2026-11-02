import { describe, expect, it } from 'vitest'
import { calibration } from '../src/config/analysis'
import { extractProfile } from '../src/domain/anc/profile'
import { profilePointAt } from '../src/domain/geometry/profile'
import { integrateVolumeMm3 } from '../src/domain/geometry/volume'
import type { Program } from '../src/domain/types'

function program(...passes: [number, number][][]): Program {
  let line = 0
  return { lineCount: passes.flat().length, sweeps: passes.map(pass => ({
    span: Math.max(...pass.map(p => p[0])) - Math.min(...pass.map(p => p[0])),
    points: pass.map(([y, z]) => ({ y, z, x: 0, line: ++line, hasY: true })),
  })) }
}

describe('zero-width cumulative cutting', () => {
  it('retains earlier local deep cuts after a shallower full-length pass', () => {
    const shape = extractProfile(program([[20, 15], [30, 15], [40, 15]], [[0, 25], [50, 25], [100, 25]]), calibration, 0)
    expect(profilePointAt(shape.points, 30).radius).toBe(15)
    expect(profilePointAt(shape.points, 10).radius).toBe(25)
    expect(integrateVolumeMm3(shape.points)).toBeCloseTo(Math.PI * (625 * 100 - 400 * 20), 8)
    expect(shape.range).toEqual({ low: 0, high: 100 })
  })

  it('does not count repeated or reverse cutting twice', () => {
    const a: [number, number][] = [[0, 25], [50, 25], [100, 25]]
    const b: [number, number][] = [[20, 15], [30, 15], [40, 15]]
    const first = extractProfile(program(a, b), calibration, 0)
    const repeated = extractProfile(program([...b].reverse(), a, b, a), calibration, 0)
    expect(integrateVolumeMm3(repeated.points)).toBeCloseTo(integrateVolumeMm3(first.points), 8)
    expect(profilePointAt(repeated.points, 30).radius).toBe(15)
  })

  it('keeps a zero-width radial plunge at its exact location without adding volume', () => {
    const shape = extractProfile(program([[0, 20], [50, 20], [100, 20]], [[50, 20], [50, 10], [50, 20]]), calibration, 0)
    expect(profilePointAt(shape.points, 50).radius).toBe(10)
    expect(profilePointAt(shape.points, 49.9).radius).toBe(20)
    expect(profilePointAt(shape.points, 50.1).radius).toBe(20)
    expect(integrateVolumeMm3(shape.points)).toBeCloseTo(Math.PI * 400 * 100, 8)
  })

  it('does not bridge uncovered gaps', () => {
    expect(() => extractProfile(program([[0, 10], [5, 10], [10, 10]], [[20, 10], [25, 10], [30, 10]]), calibration, 0)).toThrow('noProfile')
  })

  it.each([0, 5])('rejects changing X with blade width %s', width => {
    const input = program([[0, 10], [50, 10], [100, 10]])
    input.sweeps[0].points[1].x = 1
    expect(() => extractProfile(input, calibration, width)).toThrow('nonAxisymmetricProfile')
  })
})
