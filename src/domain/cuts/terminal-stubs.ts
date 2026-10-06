import type { CutEvidence, CutStrategy, ProfilePoint, StrategyContext } from '../types'

function terminalEvidence(points: ProfilePoint[], end: 'low' | 'high', context: StrategyContext): CutEvidence | null {
  const sequence = end === 'low' ? points : [...points].reverse()
  const terminal = sequence[0]
  const change = sequence.findIndex(point => Math.abs(point.radius - terminal.radius) > context.parameters.coordinateToleranceMm)
  if (change < 1) return null
  const boundary = sequence[change - 1]
  const stubLengthMm = Math.abs(boundary.y - terminal.y)
  if (stubLengthMm < context.parameters.minimumStubLengthMm) return null
  return { end, y: boundary.y, line: boundary.line, stubLengthMm }
}

export const terminalStubStrategy: CutStrategy = {
  id: 'terminal-constant-radius',
  version: '1.0.0',
  applicable: profile => profile.points.length >= 5,
  detect(profile, context) {
    const low = terminalEvidence(profile.points, 'low', context)
    const high = terminalEvidence(profile.points, 'high', context)
    const evidence = [low, high].filter((item): item is CutEvidence => item !== null)
    const partial = { ...(low && { low: low.y }), ...(high && { high: high.y }) }
    if (!low || !high) {
      return {
        status: 'undetermined', partial, evidence,
        code: !low && !high ? 'missingBothEnds' : !low ? 'missingLowEnd' : 'missingHighEnd',
      }
    }
    const cuts = {
      low: low.y + context.calibration.lowerCutCorrectionMm,
      high: high.y + context.calibration.upperCutCorrectionMm,
    }
    if (!(cuts.low < cuts.high) || cuts.low < profile.range.low || cuts.high > profile.range.high) {
      return { status: 'undetermined', code: 'invalidCuts', partial, evidence }
    }
    return { status: 'detected', cuts, evidence }
  },
}
