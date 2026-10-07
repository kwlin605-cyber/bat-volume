import { describe, expect, it } from 'vitest'
import { appendSessionFiles, createBatchSession, removeSessionFile, restoreBatchSession, sessionFiles, type BatchSession } from '../src/services/batch-session'
import { LatestSessionStorage, type SessionRepository } from '../src/services/latest-session-storage'
import type { WeightRange } from '../src/domain/weight'

const makeSession = () => createBatchSession([new File([new Uint8Array([0xa4, 0xa4, 0xff, 0])], '球棒.anc', { lastModified: 123 }), new File(['G1 Y0 Z2'], '球棒.anc', { lastModified: 456 })])
const deferred = () => { let resolve!: () => void, reject!: (reason: unknown) => void; const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }

class MemoryRepository implements SessionRepository {
  latest: BatchSession | null = null
  calls: string[] = []
  gates: ReturnType<typeof deferred>[] = []
  async read() { return this.latest }
  async replace(session: BatchSession) {
    this.calls.push(`replace:${session.id}`)
    const gate = this.gates.shift()
    if (gate) await gate.promise
    this.latest = session
  }
  async updateRequirements(id: string, values: Record<string, WeightRange>) {
    this.calls.push(`targets:${id}`)
    if (this.latest?.id === id) this.latest = { ...this.latest, requirements: values }
  }
  async clear() { this.calls.push('clear'); this.latest = null }
}

describe('the latest saved ANC batch', () => {
  it('adds duplicate names without changing existing identities, bytes or targets', async () => {
    const original = makeSession()
    original.requirements[original.files[0].id] = { min: 800, max: 850 }
    const added = appendSessionFiles(original, [new File(['new bytes'], '球棒.anc')])
    expect(added.id).toBe(original.id)
    expect(added.files.slice(0, 2)).toEqual(original.files)
    expect(added.requirements).toEqual(original.requirements)
    expect(new Set(added.files.map(file => file.id)).size).toBe(3)
    expect(await sessionFiles(added)[2].text()).toBe('new bytes')
    expect(appendSessionFiles(null, [new File(['first'], 'first.anc')]).files).toHaveLength(1)
  })
  it('removes only the chosen identity and target, and clears the session at the last file', async () => {
    const original = makeSession()
    original.requirements = { [original.files[0].id]: { min: 800, max: 850 }, [original.files[1].id]: { min: 900, max: 900 } }
    const remaining = removeSessionFile(original, original.files[0].id)!
    expect(remaining.files).toEqual([original.files[1]])
    expect(remaining.requirements).toEqual({ [original.files[1].id]: { min: 900, max: 900 } })
    expect(original.files).toHaveLength(2)
    const storage = new LatestSessionStorage(new MemoryRepository())
    await storage.replace(remaining)
    expect((await storage.read())!.files).toEqual(remaining.files)
    expect(removeSessionFile(remaining, remaining.files[0].id)).toBeNull()
  })
  it('reconstructs exact bytes and metadata, including duplicate names with different targets', async () => {
    const original = makeSession()
    const values = { [original.files[0].id]: { min: 800.123, max: 850.456 }, [original.files[1].id]: { min: 700, max: 700 } }
    const stored = structuredClone({ version: 1, id: original.id, files: original.files })
    const restored = restoreBatchSession(stored, { sessionId: original.id, values })!
    const files = sessionFiles(restored)
    expect(new Uint8Array(await files[0].arrayBuffer())).toEqual(new Uint8Array([0xa4, 0xa4, 0xff, 0]))
    expect(await files[1].text()).toBe('G1 Y0 Z2')
    expect(files.map(file => [file.name, file.lastModified])).toEqual([['球棒.anc', 123], ['球棒.anc', 456]])
    expect(restored.requirements).toEqual(values)
    expect(original.files[0].id).not.toBe(original.files[1].id)
  })
  it('rejects corrupt files but never applies stale, foreign or invalid targets', () => {
    const session = makeSession(), stored = { version: 1, id: session.id, files: session.files }
    expect(restoreBatchSession(undefined, undefined)).toBeNull()
    expect(() => restoreBatchSession({ ...stored, version: 99 }, null)).toThrow()
    expect(() => restoreBatchSession({ ...stored, files: [session.files[0], session.files[0]] }, null)).toThrow()
    expect(() => restoreBatchSession({ ...stored, files: [{ ...session.files[0], blob: 'filename-only' }] }, null)).toThrow()
    expect(restoreBatchSession(stored, { sessionId: 'previous', values: { [session.files[0].id]: { min: 800, max: 850 } } })!.requirements).toEqual({})
    expect(restoreBatchSession(stored, { sessionId: session.id, values: { foreign: { min: 800, max: 850 }, [session.files[0].id]: { min: 850, max: 800 } } })!.requirements).toEqual({})
  })
  it('orders a slow old save, replacement and clear so reopening cannot resurrect the old batch', async () => {
    const repository = new MemoryRepository(), gate = deferred()
    repository.gates.push(gate)
    const storage = new LatestSessionStorage(repository), old = makeSession(), replacement = makeSession()
    const pendingOld = storage.replace(old), pendingNew = storage.replace(replacement), cleared = storage.clear()
    await Promise.resolve()
    expect(repository.calls).toEqual([`replace:${old.id}`])
    gate.resolve()
    await Promise.all([pendingOld, pendingNew, cleared])
    expect(await storage.read()).toBeNull()
    expect(repository.calls).toEqual([`replace:${old.id}`, `replace:${replacement.id}`, 'clear'])
  })
  it('updates requirements separately from ANC bytes and clearing removes both', async () => {
    const repository = new MemoryRepository(), storage = new LatestSessionStorage(repository), session = makeSession()
    await storage.replace(session)
    const files = repository.latest!.files, values = { [session.files[0].id]: { min: 800, max: 850 } }
    await storage.updateRequirements(session.id, values)
    expect(repository.latest!.files).toBe(files)
    expect((await storage.read())!.requirements).toEqual(values)
    expect(repository.calls.filter(call => call.startsWith('replace'))).toHaveLength(1)
    await storage.updateRequirements(session.id, {})
    expect((await storage.read())!.requirements).toEqual({})
    await storage.clear()
    expect(await storage.read()).toBeNull()
  })
  it('surfaces failed writes and allows a later replacement or clear to recover', async () => {
    const repository = new MemoryRepository(), gate = deferred(), storage = new LatestSessionStorage(repository)
    repository.gates.push(gate)
    const failed = storage.replace(makeSession()), failure = expect(failed).rejects.toThrow('quota')
    gate.reject(new Error('quota')); await failure
    const latest = makeSession()
    await storage.replace(latest)
    expect((await storage.read())!.id).toBe(latest.id)
    await storage.clear()
    expect(await storage.read()).toBeNull()
  })
})
