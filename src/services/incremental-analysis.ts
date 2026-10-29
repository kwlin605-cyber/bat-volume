import type { AnalysisResult } from '../domain/types'
import type { AnalysisOutcome, AnalysisSource } from './analysis-state'

type Analyzer = (file: File, signal: AbortSignal, bladeWidthMm?: number) => Promise<AnalysisResult>
interface Job { id: string; file: File | AnalysisSource; controller: AbortController; bladeWidthMm?: number }

/** One bounded queue across uploads; removing one file cancels only its work. */
export class IncrementalAnalysis {
  private jobs = new Map<string, Job>()
  private queue: Job[] = []
  private running = 0
  private closed = false
  constructor(private readonly analyzer: Analyzer, private readonly deliver: (id: string, result: AnalysisOutcome) => void, private readonly concurrency = 2) {}

  add(files: readonly (File | AnalysisSource)[], ids: readonly string[], bladeWidthMm?: number) {
    if (this.closed) return
    files.forEach((file, index) => {
      const job = { id: ids[index], file, controller: new AbortController(), bladeWidthMm }
      this.jobs.set(job.id, job); this.queue.push(job)
    })
    this.pump()
  }
  remove(id: string) {
    const job = this.jobs.get(id)
    this.jobs.delete(id)
    job?.controller.abort()
    this.queue = this.queue.filter(item => item.id !== id)
  }
  clear() {
    const jobs = [...this.jobs.values()]
    this.jobs.clear(); this.queue = []
    for (const job of jobs) job.controller.abort()
  }
  dispose() { this.closed = true; this.clear() }
  private pump() {
    while (!this.closed && this.running < Math.max(1, this.concurrency) && this.queue.length) {
      const job = this.queue.shift()!
      ++this.running
      void this.run(job)
    }
  }
  private async run(job: Job) {
    const input = job.file
    const source = input instanceof File ? { name: input.name, size: input.size } : input.source
    const deliver = (result: AnalysisOutcome) => {
      if (this.jobs.get(job.id) !== job) return
      this.jobs.delete(job.id)
      this.deliver(job.id, result)
    }
    try {
      let file: File | null
      try { file = input instanceof File ? input : await input.load() }
      catch { deliver({ status: 'unavailable', source, reason: 'presetLoadFailed' }); return }
      if (job.controller.signal.aborted) return
      if (!file) { deliver({ status: 'unavailable', source, reason: 'presetRemoved' }); return }
      let result: AnalysisResult
      try { result = await this.analyzer(file, job.controller.signal, job.bladeWidthMm) }
      catch { result = { status: 'undetermined', source: { name: file.name, size: file.size }, code: 'processingFailed' } }
      deliver(result)
    } finally {
      --this.running
      this.pump()
    }
  }
}
