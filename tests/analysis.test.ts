import { describe, expect, it } from 'vitest'
import { analyzeAnc } from '../src/domain/analyze'
import { parseAnc } from '../src/domain/anc/parser'
import { calibration, ruleParameters } from '../src/config/analysis'
import { detectCuts } from '../src/domain/cuts/registry'
import type { CutStrategy, Profile } from '../src/domain/types'

const source = { name: 'test.anc', size: 100 }
const simpleProgram = 'G90 G0 X0 Y100\nZ30\nG1 Z10\nY95\nY94 Z12\nY6 Z20\nY5 Z10\nY0\nZ25\nG0 Z50\nG53 X0 Y0\nM30'

describe('ANC analysis', () => {
  it('keeps modal coordinates and excludes the feed retract and G53 home', () => {
    const program = parseAnc(simpleProgram)
    expect(program.sweeps).toHaveLength(1)
    expect(program.sweeps[0].points.at(-1)).toMatchObject({ y: 0, z: 10 })
    const result = analyzeAnc(simpleProgram, source)
    expect(result.status).toBe('calculated')
    if (result.status !== 'calculated') return
    expect(result.cuts).toEqual({ low: 5, high: 95 })
    expect(result.retained[0].y).toBe(result.cuts.low)
    expect(result.retained.at(-1)!.y).toBe(result.cuts.high)
    expect(result.volumeCm3).toBe(result.volumeMm3 / 1000)
    expect(result.dimensions.lengthMm).toBe(90)
    expect(result.dimensions.maximumDiameterMm).toBe(40)
    expect(result.estimated).toBe(true)
  })
  it('does not calculate a volume for unsupported incremental or arc commands', () => {
    for (const command of ['G91', 'G2 Y50 Z20 I1 J1', 'G43 H1', 'G1 A90']) {
      const result = analyzeAnc(simpleProgram.replace('G1 Z10', `${command}\nG1 Z10`), source)
      expect(result).toMatchObject({ status: 'undetermined', code: 'unsupportedInstruction' })
      expect('volumeCm3' in result).toBe(false)
    }
  })
  it('does not guess the end with no constant-radius stub', () => {
    const result = analyzeAnc(simpleProgram.replace('Y95\nY94 Z12', 'Y99.97 Z10.01\nY94 Z12'), source)
    expect(result).toMatchObject({ status: 'undetermined', code: 'missingHighEnd', partial: { low: 5 } })
    expect('volumeCm3' in result).toBe(false)
  })
  it('applies a calibration consistently to radii, cuts and retained geometry', () => {
    const result = analyzeAnc(simpleProgram, source, {
      parameters: ruleParameters,
      calibration: { ...calibration, radiusOffsetMm: 1, lowerCutCorrectionMm: 1, upperCutCorrectionMm: -1, validated: true },
    })
    expect(result.status).toBe('calculated')
    if (result.status !== 'calculated') return
    expect(result.cuts).toEqual({ low: 6, high: 94 })
    expect(result.retained[0]).toMatchObject({ y: 6, radius: 21 })
    expect(result.retained.at(-1)).toMatchObject({ y: 94, radius: 13 })
    expect(result.dimensions.lengthMm).toBe(88)
    expect(result.dimensions.maximumDiameterMm).toBe(42)
    expect(result.estimated).toBe(false)
  })
  it('does not silently choose when future cut strategies disagree', () => {
    const profile: Profile = { points: [], range: { low: 0, high: 100 }, sourceLines: { start: 1, end: 2 }, sweepCount: 1 }
    const makeStrategy = (id: string, low: number): CutStrategy => ({ id, version: '1', applicable: () => true, detect: () => ({ status: 'detected', cuts: { low, high: 95 }, evidence: [] }) })
    const result = detectCuts(profile, { calibration, parameters: ruleParameters }, [makeStrategy('a', 5), makeStrategy('b', 10)])
    expect(result.decision).toMatchObject({ status: 'undetermined', code: 'strategiesDisagree' })
  })
})
