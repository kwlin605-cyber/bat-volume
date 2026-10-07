import { analyzeAnc } from '../domain/analyze'
import type { AnalysisRequest, AnalysisResponse } from './analysis-message'

self.onmessage = (event: MessageEvent<AnalysisRequest>) => {
  const result: AnalysisResponse = { id: event.data.id, result: analyzeAnc(event.data.text, event.data.source) }
  self.postMessage(result)
}
