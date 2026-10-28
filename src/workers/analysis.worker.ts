import { analyzeAnc } from '../domain/analyze'
import { calibration, gripParameters, ruleParameters } from '../config/analysis'
import type { AnalysisRequest, AnalysisResponse } from './analysis-message'

self.onmessage = (event: MessageEvent<AnalysisRequest>) => {
  const result: AnalysisResponse = {
    id: event.data.id,
    result: analyzeAnc(
      event.data.text,
      event.data.source,
      { calibration, parameters: ruleParameters },
      { parameters: gripParameters },
      event.data.bladeWidthMm ?? 0
    ),
  }
  self.postMessage(result)
}
