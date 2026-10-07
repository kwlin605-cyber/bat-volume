import { fileLimits } from '../config/analysis'
import type { AnalysisResult, DiagnosticCode } from '../domain/types'

export async function analyzeFile(file: File, signal: AbortSignal): Promise<AnalysisResult> {
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
  return new Promise((resolve, reject) => {
    let worker: Worker | undefined
    const clean = () => { worker?.terminate(); signal.removeEventListener('abort', abort) }
    const finish = (result: AnalysisResult) => { clean(); resolve(result) }
    const abort = () => { clean(); reject(signal.reason) }
    signal.addEventListener('abort', abort, { once: true })
    try {
      signal.throwIfAborted()
      worker = new Worker(new URL('../workers/analysis.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (event: MessageEvent<AnalysisResult>) => finish(event.data)
      worker.onerror = () => finish(fail('processingFailed'))
      worker.onmessageerror = () => finish(fail('processingFailed'))
      worker.postMessage({ text, source })
    } catch { if (signal.aborted) abort(); else finish(fail('processingFailed')) }
  })
}
