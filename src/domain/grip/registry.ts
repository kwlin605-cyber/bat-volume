import type { GripContext, GripRegionDecision, GripStrategy, ProfilePoint } from '../types'
import { knobValleyStrategy } from './knob-valley'

export const gripStrategies: readonly GripStrategy[] = [knobValleyStrategy]

export function detectGripRegion(points: readonly ProfilePoint[], context: GripContext, strategies: readonly GripStrategy[] = gripStrategies) {
  const applicable = strategies.filter(strategy => strategy.applicable(points, context))
  if (!applicable.length) return { decision: { status: 'undetermined', code: 'noApplicableGripStrategy' } as GripRegionDecision, rule: null }
  const results = applicable.map(strategy => ({ strategy, decision: strategy.detect(points, context) }))
  const detected = results.filter(result => result.decision.status === 'detected')
  if (!detected.length) return { decision: results[0].decision, rule: null }
  const first = detected[0]
  if (first.decision.status !== 'detected') throw new Error('Invalid grip strategy result')
  const region = first.decision.region, end = first.decision.end
  if (detected.some(result => result.decision.status === 'detected' && (
    result.decision.end !== end || Math.abs(result.decision.region.low - region.low) > context.parameters.strategyAgreementToleranceMm ||
    Math.abs(result.decision.region.high - region.high) > context.parameters.strategyAgreementToleranceMm
  ))) return { decision: { status: 'undetermined', code: 'gripStrategiesDisagree' } as GripRegionDecision, rule: null }
  return { decision: first.decision, rule: { strategy: first.strategy.id, version: first.strategy.version } }
}
