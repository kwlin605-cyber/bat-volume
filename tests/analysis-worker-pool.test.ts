import { describe, expect, it, vi } from 'vitest'
import { AnalysisWorkerPool } from '../src/services/analysis-worker-pool'
import { analyzeFile } from '../src/services/analyze-file'
import type { AnalysisRequest, AnalysisResponse } from '../src/workers/analysis-message'
import type { AnalysisResult } from '../src/domain/types'

class TestWorker {
  onmessage: ((event: MessageEvent<AnalysisResponse>) => void) | null = null
  onerror: (() => void) | null = null
  onmessageerror: (() => void) | null = null
  requests: AnalysisRequest[] = []
  terminate = vi.fn()
  postMessage = vi.fn((request: AnalysisRequest) => this.requests.push(request))
  complete(index = this.requests.length - 1) {
    const request = this.requests[index]
    const result: AnalysisResult = { status: 'undetermined', source: request.source, code: 'noProfile' }
    this.onmessage?.({ data: { id: request.id, result } } as MessageEvent<AnalysisResponse>)
    return result
  }
}
function setup(size = 2) {
  const workers: TestWorker[] = []
  const factory = vi.fn(() => { const worker = new TestWorker(); workers.push(worker); return worker as unknown as Worker })
  const pool = new AnalysisWorkerPool(size, factory)
  const start = (name: string, controller = new AbortController()) => pool.analyze('G1', { name, size: 2 }, controller.signal)
  return { workers, factory, pool, start }
}

describe('reusable bounded analysis workers', () => {
  it('preloads two workers and reuses them across files and batches without exceeding the bound', async () => {
    const { workers, factory, pool, start } = setup()
    pool.prewarm(); pool.prewarm()
    expect(factory).toHaveBeenCalledTimes(2)
    const jobs = ['a', 'b', 'c', 'd'].map(name => start(name))
    expect(workers.map(worker => worker.requests.length)).toEqual([1, 1])
    workers[1].complete(); workers[0].complete()
    expect(workers.map(worker => worker.requests.length)).toEqual([2, 2])
    workers[0].complete(); workers[1].complete()
    expect((await Promise.all(jobs)).map(result => result.source.name)).toEqual(['a', 'b', 'c', 'd'])
    const next = start('next-batch')
    workers[0].complete()
    expect((await next).source.name).toBe('next-batch')
    expect(factory).toHaveBeenCalledTimes(2)
    expect(workers.every(worker => worker.terminate.mock.calls.length === 0)).toBe(true)
    pool.dispose()
    expect(workers.every(worker => worker.terminate.mock.calls.length === 1)).toBe(true)
  })
  it('cancels a queued file without interrupting active files or creating more workers', async () => {
    const { workers, factory, pool, start } = setup(1)
    const first = start('active'), controller = new AbortController()
    const queued = start('cancelled', controller)
    const rejection = expect(queued).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort(); await rejection
    workers[0].complete(); await first
    expect(factory).toHaveBeenCalledOnce()
    expect(workers[0].requests.map(request => request.source.name)).toEqual(['active'])
    pool.dispose()
  })
  it('terminates a cancelled active worker and cannot deliver its late result to a replacement file', async () => {
    const { workers, pool, start } = setup(1)
    const controller = new AbortController(), old = start('old', controller)
    const late = workers[0].onmessage!
    const request = workers[0].requests[0]
    const rejected = expect(old).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort(); await rejected
    const replacement = start('new')
    let delivered = false
    replacement.then(() => { delivered = true })
    late({ data: { id: request.id, result: { status: 'undetermined', source: request.source, code: 'noProfile' } } } as MessageEvent<AnalysisResponse>)
    await Promise.resolve()
    expect(delivered).toBe(false)
    expect(workers[0].terminate).toHaveBeenCalledOnce()
    workers[1].complete()
    expect((await replacement).source.name).toBe('new')
    pool.dispose()
  })
  it.each(['onerror', 'onmessageerror'] as const)('replaces a worker after %s and continues queued files', async event => {
    const { workers, pool, start } = setup(1)
    const failed = start('failed'), next = start('next')
    const rejection = expect(failed).rejects.toThrow('Analysis worker failed')
    workers[0][event]?.(); await rejection
    expect(workers[0].terminate).toHaveBeenCalledOnce()
    expect(workers[1].requests[0].source.name).toBe('next')
    workers[1].complete()
    expect((await next).source.name).toBe('next')
    pool.dispose()
  })
  it('ignores an earlier request response while its reused worker processes another file', async () => {
    const { workers, pool, start } = setup(1)
    const first = start('first')
    workers[0].complete(); await first
    const second = start('second')
    let delivered = false
    second.then(() => { delivered = true })
    workers[0].complete(0)
    await Promise.resolve()
    expect(delivered).toBe(false)
    workers[0].complete(1)
    expect((await second).source.name).toBe('second')
    pool.dispose()
  })
  it('disposes idle and busy workers and settles pending jobs when the session closes', async () => {
    const { workers, factory, pool, start } = setup(1)
    const active = start('active'), queued = start('queued')
    const rejections = [active, queued].map(job => expect(job).rejects.toMatchObject({ name: 'AbortError' }))
    pool.dispose(); pool.dispose()
    await Promise.all(rejections)
    expect(workers[0].terminate).toHaveBeenCalledOnce()
    await expect(start('closed')).rejects.toMatchObject({ name: 'AbortError' })
    pool.prewarm()
    expect(factory).toHaveBeenCalledOnce()
  })
  it('recovers from a failed preload without leaving a pending analysis or retrying indefinitely', async () => {
    const worker = new TestWorker()
    const factory = vi.fn<() => Worker>().mockImplementationOnce(() => { throw Error('load failed') }).mockReturnValue(worker as unknown as Worker)
    const pool = new AnalysisWorkerPool(1, factory)
    expect(() => pool.prewarm()).not.toThrow()
    const job = analyzeFile(new File(['G1'], 'bat.anc'), new AbortController().signal, pool)
    await vi.waitFor(() => expect(worker.requests).toHaveLength(1))
    worker.complete()
    expect(await job).toMatchObject({ source: { name: 'bat.anc' }, code: 'noProfile' })
    pool.dispose()
    const broken = new AnalysisWorkerPool(1, () => { throw Error('unavailable') })
    expect(await analyzeFile(new File(['G1'], 'bat.anc'), new AbortController().signal, broken)).toMatchObject({ code: 'processingFailed' })
    broken.dispose()
  })
})
