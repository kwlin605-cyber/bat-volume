import type { CutStrategy, Profile, RuleTrace, StrategyContext, StrategyDecision } from '../types'
import { terminalStubStrategy } from './terminal-stubs'

export const cutStrategies: readonly CutStrategy[] = [terminalStubStrategy]

export function detectCuts(
  profile: Profile,
  context: StrategyContext,
  strategies: readonly CutStrategy[] = cutStrategies,
): { decision: StrategyDecision; trace: RuleTrace | null } {
  const applicable = strategies.filter(strategy => strategy.applicable(profile, context))
  if (!applicable.length) return { decision: { status: 'undetermined', code: 'noApplicableStrategy', partial: {}, evidence: [] }, trace: null }
  const results = applicable.map(strategy => ({ strategy, decision: strategy.detect(profile, context) }))
  const detected = results.filter(result => result.decision.status === 'detected')
  if (!detected.length) return { decision: results[0].decision, trace: null }
  const first = detected[0]
  if (first.decision.status !== 'detected') throw new Error('Invalid strategy result')
  const firstCuts = first.decision.cuts
  const disagreement = detected.some(result => result.decision.status === 'detected' && (
    Math.abs(result.decision.cuts.low - firstCuts.low) > context.parameters.strategyAgreementToleranceMm ||
    Math.abs(result.decision.cuts.high - firstCuts.high) > context.parameters.strategyAgreementToleranceMm
  ))
  if (disagreement) return { decision: { status: 'undetermined', code: 'strategiesDisagree', partial: {}, evidence: [] }, trace: null }
  return {
    decision: first.decision,
    trace: { strategy: first.strategy.id, version: first.strategy.version, evidence: first.decision.evidence },
  }
}
