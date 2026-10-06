import { useEffect, useRef, useState } from 'react'
import { fileLimits } from '../config/analysis'
import type { AnalysisResult, DiagnosticCode, SourceInfo } from '../domain/types'

export type UploadState =
  | { status: 'empty' }
  | { status: 'loading'; source: SourceInfo }
  | { status: 'result'; result: AnalysisResult }

export function useAnalysis() {
  const [state, setState] = useState<UploadState>({ status: 'empty' })
  const activeWorker = useRef<Worker | null>(null)
  const request = useRef(0)
  useEffect(() => () => activeWorker.current?.terminate(), [])

  async function loadFile(file: File) {
    const token = ++request.current
    activeWorker.current?.terminate()
    activeWorker.current = null
    const source = { name: file.name, size: file.size }
    const fail = (code: DiagnosticCode) => {
      if (request.current === token) setState({ status: 'result', result: { status: 'undetermined', source, code } })
    }
    if (!file.name.toLowerCase().endsWith(fileLimits.extension)) { fail('wrongFileType'); return }
    if (file.size > fileLimits.maxBytes) { fail('fileTooLarge'); return }
    setState({ status: 'loading', source })
    try {
      const buffer = await file.arrayBuffer()
      if (request.current !== token) return
      let text: string
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer) }
      catch { text = new TextDecoder('big5').decode(buffer) }
      const worker = new Worker(new URL('../workers/analysis.worker.ts', import.meta.url), { type: 'module' })
      activeWorker.current = worker
      worker.onmessage = (event: MessageEvent<AnalysisResult>) => {
        if (request.current === token) setState({ status: 'result', result: event.data })
        worker.terminate()
        if (activeWorker.current === worker) activeWorker.current = null
      }
      worker.onerror = () => { fail('processingFailed'); worker.terminate() }
      worker.postMessage({ text, source })
    } catch { fail('readFailed') }
  }
  return { state, loadFile }
}
