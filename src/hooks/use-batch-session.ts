import { useEffect, useRef, useState } from 'react'
import { defaultBladeWidthMm } from '../domain/blade-width'
import { useAnalysis } from './use-analysis'
import { appendSessionFiles, appendSessionPreset, removeSessionFile, updateSessionRequirements, type BatchSession } from '../services/batch-session'
import { sessionSources } from '../services/session-sources'
import { presetOrigin, type AncPresetItem } from '../services/anc-catalog'
import { LatestSessionStorage } from '../services/latest-session-storage'
import type { WeightRange } from '../domain/weight'
import { createDefaultBatchDisplay, createDefaultBatchSort, normalizeBatchDisplay, type BatchDisplaySettings, type BatchSort } from '../domain/batch-display'

/** Connect the latest saved batch to analysis. Browser storage never owns analysis or UI state. */
export function useBatchSession(bladeWidthMm = defaultBladeWidthMm) {
  const analysis = useAnalysis(bladeWidthMm)
  const [storage] = useState(() => new LatestSessionStorage())
  const current = useRef<BatchSession | null>(null)
  const intent = useRef(0), saveIntent = useRef(0), mounted = useRef(false)
  const previousBladeWidth = useRef(bladeWidthMm)
  const [requirements, setRequirements] = useState<Record<string, WeightRange>>({})
  const [display, setDisplay] = useState(createDefaultBatchDisplay)
  const [sort, setSort] = useState(createDefaultBatchSort)
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
        analysis.loadSources(sessionSources(session.files), previousBladeWidth.current)
      }
    }).catch(() => { if (alive && intent.current === token) setStorageUnavailable(true) })
      .finally(() => { if (alive) setRestoring(false) })
    return () => { alive = false; mounted.current = false }
  }, [storage])

  useEffect(() => {
    if (previousBladeWidth.current !== bladeWidthMm) {
      previousBladeWidth.current = bladeWidthMm
      if (current.current && current.current.files.length > 0) {
        analysis.loadSources(sessionSources(current.current.files), bladeWidthMm)
      }
    }
  }, [bladeWidthMm])

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
    analysis.addSources(sessionSources(session.files.slice(previousCount)), bladeWidthMm)
    persist(storage.replace(session))
  }

  function addPreset(preset: AncPresetItem) {
    const previous = current.current
    const session = appendSessionPreset(previous, preset.name, presetOrigin(preset))
    if (session === previous) return
    ++intent.current
    current.current = session
    setRequirements(session.requirements); setDisplay(session.display); setRestoring(false)
    analysis.addSources(sessionSources(session.files.slice(previous?.files.length ?? 0)), bladeWidthMm)
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
    setSort(createDefaultBatchSort())
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

  // Keep sort outside the persisted session so additions/removals retain it, but reopening resets it.
  function updateSort(value: BatchSort) { setSort({ ...value }) }

  return { entries: analysis.entries, requirements, display, sort, restoring, storageUnavailable, addFiles, addPreset, removeFile, clearFiles, setFileRequirements, updateDisplay, updateSort }
}
