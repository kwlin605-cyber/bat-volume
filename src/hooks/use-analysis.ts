import { useEffect, useRef, useState } from 'react'
import { batchExecution } from '../config/batch'
import { defaultBladeWidthMm } from '../domain/blade-width'
import type { AnalysisEntry, AnalysisSource } from '../services/analysis-state'
import { AnalysisWorkerPool } from '../services/analysis-worker-pool'
import { analyzeFile } from '../services/analyze-file'
import { IncrementalAnalysis } from '../services/incremental-analysis'

export function useAnalysis(bladeWidthMm = defaultBladeWidthMm) {
  const [entries, setEntries] = useState<AnalysisEntry[]>([])
  const bladeWidthRef = useRef(bladeWidthMm)
  bladeWidthRef.current = bladeWidthMm

  const runtime = useRef<{ pool: AnalysisWorkerPool; queue: IncrementalAnalysis } | null>(null)
  function getRuntime() {
    if (!runtime.current) {
      const pool = new AnalysisWorkerPool(batchExecution.concurrency)
      const queue = new IncrementalAnalysis(
        (file, signal, width) => analyzeFile(file, signal, pool, width ?? bladeWidthRef.current),
        (id, result) => {
          setEntries(current => current.map(entry => entry.id === id ? { ...entry, source: result.source, state: result.status === 'unavailable' ? result : { status: 'result', result } } : entry))
        },
        batchExecution.concurrency
      )
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
  function addSources(files: AnalysisSource[], width = bladeWidthRef.current) {
    if (!files.length) return
    const added: AnalysisEntry[] = files.map(({ id, source, origin }) => {
      return { id, source, origin, state: { status: 'loading', source } }
    })
    setEntries(current => [...current, ...added])
    getRuntime().queue.add(files, files.map(file => file.id), width)
  }
  function clearFiles() { runtime.current?.queue.clear(); setEntries([]) }
  function loadSources(files: AnalysisSource[], width = bladeWidthRef.current) {
    clearFiles()
    addSources(files, width)
  }
  function removeFile(id: string) {
    runtime.current?.queue.remove(id)
    setEntries(current => current.filter(entry => entry.id !== id))
  }
  return { entries, loadSources, addSources, removeFile, clearFiles }
}
