import type { AnalysisResult } from '../domain/types'
import { analyzeFile } from './analyze-file'

type Analyzer = (file: File, signal: AbortSignal) => Promise<AnalysisResult>
export async function analyzeBatch(files: readonly File[], signal: AbortSignal,
  onResult: (index: number, result: AnalysisResult) => void,
  concurrency = 2, analyzer: Analyzer = analyzeFile) {
  let next = 0
  async function run() {
    while (!signal.aborted && next < files.length) {
      const index = next++
      const file = files[index]
      let result: AnalysisResult
      try { result = await analyzer(file, signal) }
      catch {
        if (signal.aborted) return
        result = { status: 'undetermined', source: { name: file.name, size: file.size }, code: 'processingFailed' }
      }
      if (!signal.aborted) onResult(index, result)
    }
  }
  await Promise.all(Array.from({ length: Math.min(files.length, Math.max(1, Math.floor(concurrency))) }, run))
}
