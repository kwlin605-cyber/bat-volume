import type { AnalysisResult } from '../domain/types'

type Analyzer = (file: File, signal: AbortSignal) => Promise<AnalysisResult>
interface Job { id: string; file: File; controller: AbortController }

/** One bounded queue across uploads; removing one file cancels only its work. */
export class IncrementalAnalysis {
  private jobs = new Map<string, Job>()
  private queue: Job[] = []
  private running = 0
  private closed = false
  constructor(private readonly analyzer: Analyzer, private readonly deliver: (id: string, result: AnalysisResult) => void, private readonly concurrency = 2) {}

  add(files: readonly File[], ids: readonly string[]) {
    if (this.closed) return
    files.forEach((file, index) => {
      const job = { id: ids[index], file, controller: new AbortController() }
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
    let result: AnalysisResult
    try { result = await this.analyzer(job.file, job.controller.signal) }
    catch { result = { status: 'undetermined', source: { name: job.file.name, size: job.file.size }, code: 'processingFailed' } }
    if (this.jobs.get(job.id) === job) {
      this.jobs.delete(job.id)
      this.deliver(job.id, result)
    }
    --this.running
    this.pump()
  }
}
