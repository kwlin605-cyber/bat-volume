import { validWeightRange, type WeightRange } from '../domain/weight'
import { sessionStorage } from '../config/session'

export interface SessionFile { id: string; name: string; lastModified: number; blob: Blob }
export interface BatchSession { id: string; files: SessionFile[]; requirements: Record<string, WeightRange> }
export interface StoredFiles { version: number; id: string; files: SessionFile[] }
export interface StoredRequirements { sessionId: string; values: Record<string, WeightRange> }

export function createBatchSession(files: readonly File[]): BatchSession {
  const id = crypto.randomUUID()
  return { id, files: files.map((file, index) => ({ id: `${id}:${index}`, name: file.name, lastModified: file.lastModified, blob: file })), requirements: {} }
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

/** Rebuild actual File objects so decoding and geometry still use the normal analysis path. */
export const sessionFiles = (session: BatchSession) => session.files.map(item => new File([item.blob], item.name, { type: item.blob.type, lastModified: item.lastModified }))

export function restoreBatchSession(files: unknown, requirements: unknown): BatchSession | null {
  if (files === undefined) return null
  const stored = files as Partial<StoredFiles> | null
  if (!stored || stored.version !== sessionStorage.formatVersion || typeof stored.id !== 'string' || !stored.id || !Array.isArray(stored.files) || !stored.files.length) throw new Error('Invalid saved files')
  const ids = new Set<string>()
  for (const file of stored.files) {
    if (!file || typeof file.id !== 'string' || !file.id || ids.has(file.id) || typeof file.name !== 'string' || !Number.isFinite(file.lastModified) || !(file.blob instanceof Blob)) throw new Error('Invalid saved file')
    ids.add(file.id)
  }
  const saved = requirements as Partial<StoredRequirements> | null
  const values: Record<string, WeightRange> = {}
  if (saved?.sessionId === stored.id && saved.values && typeof saved.values === 'object') {
    for (const [id, range] of Object.entries(saved.values)) {
      if (ids.has(id) && range && validWeightRange(range)) values[id] = { min: range.min, max: range.max }
    }
  }
  return { id: stored.id, files: stored.files, requirements: values }
}
