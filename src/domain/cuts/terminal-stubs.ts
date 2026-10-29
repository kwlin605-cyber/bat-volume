import type { CutEvidence, CutStrategy, ProfilePoint, StrategyContext } from '../types'

function terminalEvidence(points: ProfilePoint[], end: 'low' | 'high', context: StrategyContext): CutEvidence | null {
  const sequence = end === 'low' ? points : [...points].reverse()
  const terminal = sequence[0]
  let riseStart: ProfilePoint | undefined
  for (let index = 1; index < sequence.length; index++) {
    const previous = sequence[index - 1], point = sequence[index]
    const difference = point.radius - previous.radius
    // Floating-point equality must not turn envelope intersections into tiny rises or falls.
    const roundoff = Number.EPSILON * Math.max(1, previous.radius, point.radius) * 8
    if (difference < -roundoff) riseStart = undefined
    else if (difference > roundoff) riseStart ??= previous
    // Confirm the whole rise, then return its origin, not the point crossing the tolerance.
    // Subdividing a shallow ramp must not move the cut or make that ramp disappear.
    if (riseStart && point.radius - riseStart.radius > context.parameters.coordinateToleranceMm) {
      const stubLengthMm = Math.abs(riseStart.y - terminal.y)
      if (stubLengthMm < context.parameters.minimumStubLengthMm) return null
      return { end, y: riseStart.y, line: riseStart.line, stubLengthMm }
    }
  }
  return null
}

export const terminalStubStrategy: CutStrategy = {
  id: 'terminal-first-rise',
  version: '1.0.0',
  applicable: profile => profile.points.length >= 2,
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
