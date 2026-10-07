import { fileLimits } from '../config/analysis'
import type { AnalysisResult, DiagnosticCode } from '../domain/types'
import { AnalysisWorkerPool, type AnalysisExecutor } from './analysis-worker-pool'

export async function analyzeFile(file: File, signal: AbortSignal, executor?: AnalysisExecutor): Promise<AnalysisResult> {
  signal.throwIfAborted()
  const source = { name: file.name, size: file.size }
  const fail = (code: DiagnosticCode): AnalysisResult => ({ status: 'undetermined', source, code })
  if (!file.name.toLowerCase().endsWith(fileLimits.extension)) return fail('wrongFileType')
  if (file.size > fileLimits.maxBytes) return fail('fileTooLarge')
  let buffer: ArrayBuffer
  try { buffer = await file.arrayBuffer() }
  catch { signal.throwIfAborted(); return fail('readFailed') }
  signal.throwIfAborted()
  let text: string
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer) }
  catch { text = new TextDecoder('big5').decode(buffer) }
  const ownedSession = executor ? null : new AnalysisWorkerPool(1)
  const session = executor ?? ownedSession!
  try { return await session.analyze(text, source, signal) }
  catch { signal.throwIfAborted(); return fail('processingFailed') }
  finally { ownedSession?.dispose() }
}
