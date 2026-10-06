import { analyzeAnc } from '../domain/analyze'
import type { SourceInfo } from '../domain/types'

self.onmessage = (event: MessageEvent<{ text: string; source: SourceInfo }>) => {
  self.postMessage(analyzeAnc(event.data.text, event.data.source))
}
