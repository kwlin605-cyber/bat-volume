import { useEffect, useRef, useState } from 'react'
import { analyzeBatch } from '../services/analyze-batch'
import { batchExecution } from '../config/batch'
import type { AnalysisEntry } from '../services/analysis-state'

export function useAnalysis() {
  const [entries, setEntries] = useState<AnalysisEntry[]>([])
  const active = useRef<AbortController | null>(null)
  const request = useRef(0)
  useEffect(() => () => { ++request.current; active.current?.abort() }, [])

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
    void analyzeBatch(files, controller.signal, (index, result) => {
      if (request.current === token) setEntries(current => current.map((entry, position) =>
        position === index ? { ...entry, state: { status: 'result', result } } : entry))
    }, batchExecution.concurrency)
  }
  return { entries, loadFiles }
}
