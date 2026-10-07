import { useEffect, useRef, useState } from 'react'
import { analyzeBatch } from '../services/analyze-batch'
import { batchExecution } from '../config/batch'
import type { AnalysisEntry } from '../services/analysis-state'
import { AnalysisWorkerPool } from '../services/analysis-worker-pool'
import { analyzeFile } from '../services/analyze-file'

export function useAnalysis() {
  const [entries, setEntries] = useState<AnalysisEntry[]>([])
  const active = useRef<AbortController | null>(null)
  const request = useRef(0)
  const pool = useRef<AnalysisWorkerPool | null>(null)
  function getPool() { return pool.current ??= new AnalysisWorkerPool(batchExecution.concurrency) }
  useEffect(() => {
    const session = getPool()
    session.prewarm()
    return () => {
      ++request.current; active.current?.abort(); session.dispose()
      if (pool.current === session) pool.current = null
    }
  }, [])

  function loadFiles(files: File[]) {
    if (!files.length) return
    const token = ++request.current
    active.current?.abort()
    const controller = new AbortController()
    active.current = controller
    setEntries(files.map((file, index) => {
      const source = { name: file.name, size: file.size }
      return { id: `${token}:${index}`, source, state: { status: 'loading', source } }
    }))
    const session = getPool()
    void analyzeBatch(files, controller.signal, (index, result) => {
      if (request.current === token) setEntries(current => current.map((entry, position) =>
        position === index ? { ...entry, state: { status: 'result', result } } : entry))
    }, batchExecution.concurrency, (file, signal) => analyzeFile(file, signal, session))
  }
  return { entries, loadFiles }
}
