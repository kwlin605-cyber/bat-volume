import { validWeightRange, type WeightRange } from '../domain/weight'
import { sessionStorage } from '../config/session'
import { createDefaultBatchDisplay, normalizeBatchDisplay, type BatchDisplaySettings } from '../domain/batch-display'
import type { FileOrigin, PresetOrigin } from './file-origin'

export type SessionFile = { id: string; name: string } & (
  | { origin?: Extract<FileOrigin, { kind: 'upload' }>; lastModified: number; blob: Blob }
  | { origin: PresetOrigin; lastModified?: never; blob?: never }
)
export interface BatchSession { id: string; files: SessionFile[]; requirements: Record<string, WeightRange>; display: BatchDisplaySettings }
export interface StoredFiles { version: number; id: string; files: SessionFile[] }
export interface StoredRequirements { sessionId: string; values: Record<string, WeightRange> }
export interface StoredDisplay { version: number; sessionId: string; value: BatchDisplaySettings }

export function createBatchSession(files: readonly File[]): BatchSession {
  const id = crypto.randomUUID()
  return { id, files: files.map((file, index) => ({ id: `${id}:${index}`, name: file.name, origin: { kind: 'upload' }, lastModified: file.lastModified, blob: file })), requirements: {}, display: createDefaultBatchDisplay() }
}

export function appendSessionPreset(session: BatchSession | null, name: string, origin: PresetOrigin): BatchSession {
  if (session?.files.some(file => file.origin?.kind === 'preset' && file.origin.id === origin.id)) return session
  const current = session ?? createBatchSession([])
  return { ...current, files: [...current.files, { id: crypto.randomUUID(), name, origin }] }
}

/** Existing identities and committed targets survive additions, even for duplicate filenames. */
export function appendSessionFiles(session: BatchSession | null, files: readonly File[]): BatchSession {
  const added = createBatchSession(files)
  return session ? { ...session, files: [...session.files, ...added.files] } : added
}

export function removeSessionFile(session: BatchSession, id: string): BatchSession | null {
  const files = session.files.filter(file => file.id !== id)
  if (!files.length) return null
  const requirements = { ...session.requirements }
  delete requirements[id]
  return { ...session, files, requirements }
}

/** Apply one validated range to live file identities in a single immutable update. */
export function updateSessionRequirements(session: BatchSession, ids: readonly string[], range: WeightRange | null): BatchSession {
  if (range && !validWeightRange(range)) return session
  const liveIds = new Set(session.files.map(file => file.id))
  const selected = [...new Set(ids)].filter(id => liveIds.has(id))
  if (!selected.length) return session
  const requirements = { ...session.requirements }
  for (const id of selected) {
    if (range) requirements[id] = { ...range }
    else delete requirements[id]
  }
  return { ...session, requirements }
}

export function restoreBatchSession(files: unknown, requirements: unknown, display?: unknown): BatchSession | null {
  if (files === undefined) return null
  const stored = files as Partial<StoredFiles> | null
  const supportedVersion = (version: unknown) => version === 1 || version === sessionStorage.formatVersion
  if (!stored || !supportedVersion(stored.version) || typeof stored.id !== 'string' || !stored.id || !Array.isArray(stored.files) || !stored.files.length) throw new Error('Invalid saved files')
  const ids = new Set<string>()
  for (const file of stored.files) {
    if (!file || typeof file.id !== 'string' || !file.id || ids.has(file.id) || typeof file.name !== 'string') throw new Error('Invalid saved file')
    const origin = file.origin
    if (origin?.kind === 'preset') {
      if (stored.version === 1 || typeof origin.id !== 'string' || !origin.id.startsWith('/src/assets/anc/') || typeof origin.label !== 'string' || !origin.label || file.blob !== undefined) throw new Error('Invalid saved preset')
    } else if ((origin !== undefined && origin.kind !== 'upload') || !Number.isFinite(file.lastModified) || !(file.blob instanceof Blob)) throw new Error('Invalid saved upload')
    ids.add(file.id)
  }
  const saved = requirements as Partial<StoredRequirements> | null
  const values: Record<string, WeightRange> = {}
  if (saved?.sessionId === stored.id && saved.values && typeof saved.values === 'object') {
    for (const [id, range] of Object.entries(saved.values)) {
      if (ids.has(id) && range && validWeightRange(range)) values[id] = { min: range.min, max: range.max }
    }
  }
  const presentation = display as Partial<StoredDisplay> | null
  const settings = supportedVersion(presentation?.version) && presentation?.sessionId === stored.id
    ? normalizeBatchDisplay(presentation.value) : createDefaultBatchDisplay()
  return { id: stored.id, files: stored.files, requirements: values, display: settings }
}
