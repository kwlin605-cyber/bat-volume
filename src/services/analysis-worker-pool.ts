import type { AnalysisResult, SourceInfo } from '../domain/types'
import type { AnalysisRequest, AnalysisResponse } from '../workers/analysis-message'

export interface AnalysisExecutor {
  analyze(text: string, source: SourceInfo, signal: AbortSignal, bladeWidthMm?: number): Promise<AnalysisResult>
}
interface Job {
  request: AnalysisRequest; signal: AbortSignal; abort: () => void
  resolve: (result: AnalysisResult) => void; reject: (reason: unknown) => void
}
interface Slot { worker: Worker; job: Job | null }
const createWorker = () => new Worker(new URL('../workers/analysis.worker.ts', import.meta.url), { type: 'module' })

/** Owned by one analysis session. Idle workers are retained; cancelled or failed workers are replaced. */
export class AnalysisWorkerPool implements AnalysisExecutor {
  private slots: Slot[] = []
  private queue: Job[] = []
  private nextId = 0
  private closed = false
  private readonly size: number

  constructor(size: number, private readonly factory: () => Worker = createWorker) {
    this.size = Number.isFinite(size) ? Math.max(1, Math.floor(size)) : 1
  }

  prewarm() {
    if (this.closed) return
    try { while (this.slots.length < this.size) this.addSlot() }
    catch { /* A later analysis can retry loading; prewarming must not block the UI. */ }
  }

  analyze(text: string, source: SourceInfo, signal: AbortSignal, bladeWidthMm?: number): Promise<AnalysisResult> {
    signal.throwIfAborted()
    if (this.closed) return Promise.reject(new DOMException('Analysis session closed', 'AbortError'))
    return new Promise((resolve, reject) => {
      const job: Job = { request: { id: ++this.nextId, text, source, bladeWidthMm }, signal, resolve, reject, abort: () => this.cancel(job) }
      signal.addEventListener('abort', job.abort, { once: true })
      this.queue.push(job)
      this.pump()
    })
  }

  dispose() {
    if (this.closed) return
    this.closed = true
    const jobs = [...this.queue, ...this.slots.flatMap(slot => slot.job ? [slot.job] : [])]
    this.queue = []
    for (const slot of [...this.slots]) this.removeSlot(slot)
    for (const job of jobs) this.reject(job, new DOMException('Analysis session closed', 'AbortError'))
  }

  private addSlot(): Slot {
    const slot: Slot = { worker: this.factory(), job: null }
    slot.worker.onmessage = (event: MessageEvent<AnalysisResponse>) => {
      const job = slot.job
      if (!job || event.data.id !== job.request.id) return
      slot.job = null
      job.signal.removeEventListener('abort', job.abort)
      job.resolve(event.data.result)
      this.pump()
    }
    slot.worker.onerror = () => {
      this.removeSlot(slot)
      if (!this.closed) this.addSlot()
      this.pump()
    }
    this.slots.push(slot)
    return slot
  }

  private removeSlot(slot: Slot) {
    this.slots = this.slots.filter(candidate => candidate !== slot)
    try { slot.worker.terminate() }
    catch { /* Terminate errors must not throw into calling UI. */ }
    if (slot.job) this.reject(slot.job, new Error('Analysis worker terminated unexpectedly'))
  }

  private cancel(job: Job) {
    job.signal.removeEventListener('abort', job.abort)
    this.queue = this.queue.filter(candidate => candidate !== job)
    const slot = this.slots.find(candidate => candidate.job === job)
    if (slot) {
      slot.job = null
      this.removeSlot(slot)
      if (!this.closed) this.addSlot()
      this.pump()
    }
    this.reject(job, new DOMException('Analysis aborted', 'AbortError'))
  }

  private pump() {
    if (this.closed) return
    const slot = this.slots.find(candidate => candidate.job === null)
    if (!slot) return
    const job = this.queue.shift()
    if (!job) return
    slot.job = job
    try { slot.worker.postMessage(job.request) }
    catch (error) {
      this.removeSlot(slot)
      if (!this.closed) this.addSlot()
      this.reject(job, error)
      this.pump()
    }
  }

  private reject(job: Job, error: unknown) {
    job.signal.removeEventListener('abort', job.abort)
    job.reject(error)
  }
}
