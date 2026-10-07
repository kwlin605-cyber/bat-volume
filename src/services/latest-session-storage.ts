import { sessionStorage } from '../config/session'
import { restoreBatchSession, type BatchSession, type StoredDisplay, type StoredFiles, type StoredRequirements } from './batch-session'
import type { WeightRange } from '../domain/weight'
import type { BatchDisplaySettings } from '../domain/batch-display'

export interface SessionRepository {
  read(): Promise<BatchSession | null>
  replace(session: BatchSession): Promise<void>
  updateRequirements(id: string, values: Record<string, WeightRange>): Promise<void>
  updateDisplay(id: string, value: BatchDisplaySettings): Promise<void>
  clear(): Promise<void>
}

/** Serialize changes so a slow previous save cannot resurrect a replaced or cleared batch. */
export class LatestSessionStorage implements SessionRepository {
  private pending: Promise<void> = Promise.resolve()
  constructor(private readonly repository: SessionRepository = new IndexedDbSessionRepository()) {}
  read() { return this.pending.then(() => this.repository.read()) }
  replace(session: BatchSession) { return this.write(() => this.repository.replace(session)) }
  updateRequirements(id: string, values: Record<string, WeightRange>) { return this.write(() => this.repository.updateRequirements(id, values)) }
  updateDisplay(id: string, value: BatchDisplaySettings) { return this.write(() => this.repository.updateDisplay(id, value)) }
  clear() { return this.write(() => this.repository.clear()) }
  private write(operation: () => Promise<void>) {
    const result = this.pending.then(operation)
    this.pending = result.catch(() => {})
    return result
  }
}

class IndexedDbSessionRepository implements SessionRepository {
  private opening: Promise<IDBDatabase> | null = null
  private open(): Promise<IDBDatabase> {
    return this.opening ??= new Promise<IDBDatabase>((resolve, reject) => {
      let settled = false
      const request = indexedDB.open(sessionStorage.database, sessionStorage.databaseVersion)
      request.onupgradeneeded = () => request.result.createObjectStore(sessionStorage.store)
      request.onerror = () => { settled = true; reject(request.error) }
      request.onblocked = () => { settled = true; reject(new Error('Session database blocked')) }
      request.onsuccess = () => {
        const db = request.result
        if (settled) { db.close(); return }
        db.onversionchange = () => { db.close(); this.opening = null }
        resolve(db)
      }
    }).catch(error => { this.opening = null; throw error })
  }

  async read(): Promise<BatchSession | null> {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(sessionStorage.store, 'readonly'), store = tx.objectStore(sessionStorage.store)
      const files = store.get(sessionStorage.filesKey), requirements = store.get(sessionStorage.requirementsKey)
      const display = store.get(sessionStorage.displayKey)
      tx.oncomplete = () => {
        try { resolve(restoreBatchSession(files.result, requirements.result, display.result)) } catch (error) { reject(error) }
      }
      tx.onabort = () => reject(tx.error ?? new Error('Session read aborted'))
      tx.onerror = () => reject(tx.error)
    })
  }

  replace(session: BatchSession) {
    return this.mutate(store => {
      const files: StoredFiles = { version: sessionStorage.formatVersion, id: session.id, files: session.files }
      const requirements: StoredRequirements = { sessionId: session.id, values: session.requirements }
      store.put(files, sessionStorage.filesKey)
      store.put(requirements, sessionStorage.requirementsKey)
      store.put({ version: sessionStorage.formatVersion, sessionId: session.id, value: session.display } satisfies StoredDisplay, sessionStorage.displayKey)
    })
  }

  updateRequirements(id: string, values: Record<string, WeightRange>) {
    return this.updateForSession(id, sessionStorage.requirementsKey, { sessionId: id, values } satisfies StoredRequirements)
  }

  updateDisplay(id: string, value: BatchDisplaySettings) {
    return this.updateForSession(id, sessionStorage.displayKey, { version: sessionStorage.formatVersion, sessionId: id, value } satisfies StoredDisplay)
  }

  private updateForSession(id: string, key: string, value: StoredRequirements | StoredDisplay) {
    return this.mutate(store => {
      const request = store.get(sessionStorage.filesKey)
      request.onsuccess = () => {
        // Another tab may have replaced the batch; never attach preferences to its files.
        if (request.result?.id === id) store.put(value, key)
      }
    })
  }

  clear() { return this.mutate(store => store.clear()) }

  private async mutate(write: (store: IDBObjectStore) => void): Promise<void> {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(sessionStorage.store, 'readwrite')
      tx.oncomplete = () => resolve()
      tx.onabort = () => reject(tx.error ?? new Error('Session save aborted'))
      tx.onerror = () => reject(tx.error)
      try { write(tx.objectStore(sessionStorage.store)) }
      catch (error) { tx.abort(); reject(error) }
    })
  }
}
