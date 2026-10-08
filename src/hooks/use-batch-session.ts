import { useEffect, useRef, useState } from 'react'
import { useAnalysis } from './use-analysis'
import { appendSessionFiles, removeSessionFile, sessionFiles, updateSessionRequirements, type BatchSession } from '../services/batch-session'
import { LatestSessionStorage } from '../services/latest-session-storage'
import type { WeightRange } from '../domain/weight'
import { createDefaultBatchDisplay, normalizeBatchDisplay, type BatchDisplaySettings } from '../domain/batch-display'

/** Connect the latest saved batch to analysis. Browser storage never owns analysis or UI state. */
export function useBatchSession() {
  const analysis = useAnalysis()
  const [storage] = useState(() => new LatestSessionStorage())
  const current = useRef<BatchSession | null>(null)
  const intent = useRef(0), saveIntent = useRef(0), mounted = useRef(false)
  const [requirements, setRequirements] = useState<Record<string, WeightRange>>({})
  const [display, setDisplay] = useState(createDefaultBatchDisplay)
  const [restoring, setRestoring] = useState(true)
  const [storageUnavailable, setStorageUnavailable] = useState(false)

  useEffect(() => {
    mounted.current = true
    let alive = true
    const token = intent.current
    void storage.read().then(session => {
      if (!alive || intent.current !== token) return
      current.current = session
      if (session) {
        setRequirements(session.requirements)
        setDisplay(session.display)
        analysis.loadFiles(sessionFiles(session), session.files.map(item => item.id))
      }
    }).catch(() => { if (alive && intent.current === token) setStorageUnavailable(true) })
      .finally(() => { if (alive) setRestoring(false) })
    return () => { alive = false; mounted.current = false }
  }, [storage])

  function persist(operation: Promise<void>) {
    const token = ++saveIntent.current
    void operation.then(() => {
      if (mounted.current && saveIntent.current === token) setStorageUnavailable(false)
    }).catch(() => {
      if (mounted.current && saveIntent.current === token) setStorageUnavailable(true)
    })
  }

  function addFiles(files: File[]) {
    if (!files.length) return
    ++intent.current
    const previousCount = current.current?.files.length ?? 0
    const session = appendSessionFiles(current.current, files)
    current.current = session
    setRequirements(session.requirements); setDisplay(session.display); setRestoring(false)
    analysis.addFiles(files, session.files.slice(previousCount).map(item => item.id))
    persist(storage.replace(session))
  }

  function removeFile(id: string) {
    const session = current.current
    if (!session?.files.some(file => file.id === id)) return
    const remaining = removeSessionFile(session, id)
    if (!remaining) { clearFiles(); return }
    ++intent.current
    current.current = remaining
    setRequirements(remaining.requirements)
    analysis.removeFile(id)
    persist(storage.replace(remaining))
  }

  function clearFiles() {
    ++intent.current
    current.current = null
    setRequirements({}); setDisplay(createDefaultBatchDisplay()); setRestoring(false)
    analysis.clearFiles()
    persist(storage.clear())
  }

  function setFileRequirements(ids: readonly string[], range: WeightRange | null) {
    const session = current.current
    if (!session) return
    const next = updateSessionRequirements(session, ids, range)
    if (next === session) return
    current.current = next
    setRequirements(next.requirements)
    persist(storage.updateRequirements(next.id, next.requirements))
  }

  function updateDisplay(value: BatchDisplaySettings) {
    const session = current.current
    if (!session) return
    const next = normalizeBatchDisplay(value)
    current.current = { ...session, display: next }
    setDisplay(next)
    persist(storage.updateDisplay(session.id, next))
  }

  return { entries: analysis.entries, requirements, display, restoring, storageUnavailable, addFiles, removeFile, clearFiles, setFileRequirements, updateDisplay }
}
