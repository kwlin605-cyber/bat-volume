import { describe, expect, it } from 'vitest'
import { detectCuts } from '../src/domain/cuts/registry'
import { calibration, ruleParameters } from '../src/config/analysis'
import type { Profile } from '../src/domain/types'

const context = { calibration, parameters: ruleParameters }
function profile(coordinates: number[][]): Profile {
  const points = coordinates.map(([y, radius], i) => ({ y, radius, line: i + 1 }))
  return { points, range: { low: points[0].y, high: points.at(-1)!.y }, sourceLines: { start: 1, end: points.length }, sweepCount: 1 }
}
const cuts = (coordinates: number[][]) => detectCuts(profile(coordinates), context).decision

describe('first inward rise on the full contour', () => {
  it('locates both off-grid slope starts with only four contour points', () => {
    expect(cuts([[0, 10], [7.931, 10], [90.123, 20], [100, 20]]))
      .toMatchObject({ status: 'undetermined', code: 'missingHighEnd', partial: { low: 7.931 } })
    expect(cuts([[0, 10], [7.931, 10], [20, 20], [80, 20], [90.123, 10], [100, 10]]))
      .toMatchObject({ status: 'detected', cuts: { low: 7.931, high: 90.123 } })
  })

  it('skips narrowing steps on both ends and keeps the first widening, even below the outer radius', () => {
    expect(cuts([[0, 30], [2, 30], [2, 15], [5, 15], [5, 10], [7.931, 10],
      [20, 20], [80, 20], [90.123, 10], [95, 10], [95, 15], [98, 15], [98, 30], [100, 30]]))
      .toMatchObject({ status: 'detected', cuts: { low: 7.931, high: 90.123 } })
  })

  it('uses the exact Y of vertical rises and leaves the original geometry untouched', () => {
    const input = profile([[0, 10], [5.017, 10], [5.017, 20], [94.983, 20], [94.983, 10], [100, 10]])
    const before = structuredClone(input)
    expect(detectCuts(input, context).decision).toMatchObject({ status: 'detected', cuts: { low: 5.017, high: 94.983 } })
    expect(input).toEqual(before)
  })

  it('accumulates a shallow rise and returns its start independently of segmentation', () => {
    const sparse = [[0, 10], [5.017, 10], [15.017, 10.01], [84.983, 10.01], [94.983, 10], [100, 10]]
    const dense = [[0, 10], [5.017, 10], ...Array.from({ length: 10 }, (_, i) => [6.017 + i, 10 + (i + 1) * .001]),
      ...Array.from({ length: 11 }, (_, i) => [84.983 + i, 10.01 - i * .001]), [100, 10]]
    for (const points of [sparse, dense]) expect(cuts(points))
      .toMatchObject({ status: 'detected', cuts: { low: 5.017, high: 94.983 } })
  })

  it('ignores sub-tolerance bumps and floating point noise before the real rise', () => {
    expect(cuts([[0, 10], [1, 10], [2, 10.002], [3, 10], [5.017, 10 + Number.EPSILON * 8],
      [20, 20], [80, 20], [94.983, 10], [100, 10]]))
      .toMatchObject({ status: 'detected', cuts: { low: 5.017, high: 94.983 } })
  })

  it('rejects ends without a rise or with insufficient reserved length', () => {
    expect(cuts([[0, 10], [100, 10]]).status).toBe('undetermined')
    expect(cuts([[0, 10], [.1, 10], [.2, 20], [80, 20], [95, 10], [100, 10]]))
      .toMatchObject({ status: 'undetermined', code: 'missingLowEnd', partial: { high: 95 } })
    expect(cuts([[0, 10], [50, 10.002], [100, 10]]))
      .toMatchObject({ status: 'undetermined', code: 'missingBothEnds' })
  })

  it('preserves the cut under axial translation and reversed orientation', () => {
    const points = [[0, 30], [2, 30], [2, 10], [7.931, 10], [20, 20], [80, 20], [90.123, 10], [100, 10]]
    const transformed = points.map(([y, r]) => [123.456 - y, r]).reverse()
    const decision = cuts(transformed)
    expect(decision.status).toBe('detected')
    if (decision.status !== 'detected') throw new Error('Expected detected cuts')
    expect(decision.cuts.low).toBeCloseTo(123.456 - 90.123, 10)
    expect(decision.cuts.high).toBeCloseTo(123.456 - 7.931, 10)
  })

  it('rejects coincident cuts and invalid calibration while preserving the normal correction path', () => {
    expect(cuts([[0, 20], [50, 20], [50, 10], [50, 20], [100, 20]]))
      .toMatchObject({ status: 'undetermined', code: 'invalidCuts' })
    const input = profile([[0, 10], [5, 10], [20, 20], [80, 20], [95, 10], [100, 10]])
    for (const offset of [-6, 100, NaN]) expect(detectCuts(input, {
      ...context, calibration: { ...calibration, lowerCutCorrectionMm: offset },
    }).decision).toMatchObject({ status: 'undetermined', code: 'invalidCuts' })
  })
})
