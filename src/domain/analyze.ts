import { calibration, gripParameters, ruleParameters } from '../config/analysis'
import { AnalysisError } from './types'
import type { AnalysisResult, GripContext, Profile, SourceInfo, StrategyContext } from './types'
import { parseAnc } from './anc/parser'
import { extractProfile } from './anc/profile'
import { detectCuts } from './cuts/registry'
import { clipProfile, integrateVolumeMm3 } from './geometry/volume'
import { measureDimensions } from './geometry/dimensions'

export function analyzeAnc(text: string, source: SourceInfo, context: StrategyContext = { calibration, parameters: ruleParameters }, gripContext: GripContext = { parameters: gripParameters }): AnalysisResult {
  let profile: Profile | undefined
  try {
    profile = extractProfile(parseAnc(text), context.calibration)
    const { decision, trace } = detectCuts(profile, context)
    if (decision.status !== 'detected' || !trace) {
      return { status: 'undetermined', source, profile, code: decision.status === 'undetermined' ? decision.code : 'processingFailed', partial: decision.status === 'undetermined' ? decision.partial : {} }
    }
    const retained = clipProfile(profile.points, decision.cuts)
    const volumeMm3 = integrateVolumeMm3(retained)
    return {
      status: 'calculated', source, profile, retained, cuts: decision.cuts,
      volumeMm3, volumeCm3: volumeMm3 / 1000, dimensions: measureDimensions(retained, gripContext),
      estimated: !context.calibration.validated,
      rule: trace,
      calibration: { id: context.calibration.id, version: context.calibration.version },
    }
  } catch (error) {
    return { status: 'undetermined', source, profile, code: error instanceof AnalysisError ? error.code : 'processingFailed', detail: error instanceof AnalysisError ? error.detail : undefined }
  }
}
