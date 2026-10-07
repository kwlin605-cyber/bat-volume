import { useEffect, useRef, useState } from 'react'
import { batchExecution } from '../config/batch'
import type { AnalysisEntry } from '../services/analysis-state'
import { AnalysisWorkerPool } from '../services/analysis-worker-pool'
import { analyzeFile } from '../services/analyze-file'
import { IncrementalAnalysis } from '../services/incremental-analysis'

export function useAnalysis() {
  const [entries, setEntries] = useState<AnalysisEntry[]>([])
  const runtime = useRef<{ pool: AnalysisWorkerPool; queue: IncrementalAnalysis } | null>(null)
  function getRuntime() {
    if (!runtime.current) {
      const pool = new AnalysisWorkerPool(batchExecution.concurrency)
      const queue = new IncrementalAnalysis((file, signal) => analyzeFile(file, signal, pool), (id, result) => {
        setEntries(current => current.map(entry => entry.id === id ? { ...entry, state: { status: 'result', result } } : entry))
      }, batchExecution.concurrency)
      runtime.current = { pool, queue }
    }
    return runtime.current
  }
  useEffect(() => {
    const session = getRuntime()
    session.pool.prewarm()
    return () => {
      session.queue.dispose(); session.pool.dispose()
      if (runtime.current === session) runtime.current = null
    }
  }, [])
  function addFiles(files: File[], ids: readonly string[]) {
    if (!files.length) return
    const added: AnalysisEntry[] = files.map((file, index) => {
      const source = { name: file.name, size: file.size }
      return { id: ids[index], source, state: { status: 'loading', source } }
    })
    setEntries(current => [...current, ...added])
    getRuntime().queue.add(files, ids)
  }
  function clearFiles() { runtime.current?.queue.clear(); setEntries([]) }
  function loadFiles(files: File[], ids: readonly string[]) { clearFiles(); addFiles(files, ids) }
  function removeFile(id: string) {
    runtime.current?.queue.remove(id)
    setEntries(current => current.filter(entry => entry.id !== id))
  }
  return { entries, loadFiles, addFiles, removeFile, clearFiles }
}
