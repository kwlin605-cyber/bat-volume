import { describe, expect, it, vi } from 'vitest'
import { IncrementalAnalysis } from '../src/services/incremental-analysis'
import type { AnalysisResult } from '../src/domain/types'

const file = (name: string) => new File(['G1'], name)
const result = (name: string): AnalysisResult => ({ status: 'undetermined', source: { name, size: 2 }, code: 'noProfile' })
function harness() {
  const tasks: { file: File; signal: AbortSignal; resolve: (value: AnalysisResult) => void }[] = []
  const deliver = vi.fn()
  const analyze = vi.fn((file: File, signal: AbortSignal) => new Promise<AnalysisResult>(resolve => tasks.push({ file, signal, resolve })))
  return { tasks, analyze, deliver, queue: new IncrementalAnalysis(analyze, deliver, 2) }
}
const finish = async (task: ReturnType<typeof harness>['tasks'][number]) => { task.resolve(result(task.file.name)); await Promise.resolve() }

describe('incremental file analysis', () => {
  it('shares a bounded queue across additions and never reanalyzes finished files', async () => {
    const h = harness()
    h.queue.add([file('a'), file('b'), file('c')], ['a', 'b', 'c'])
    h.queue.add([file('d')], ['d'])
    expect(h.tasks.map(task => task.file.name)).toEqual(['a', 'b'])
    await finish(h.tasks[0])
    expect(h.tasks.map(task => task.file.name)).toEqual(['a', 'b', 'c'])
    await finish(h.tasks[1]); await finish(h.tasks[2]); await finish(h.tasks[3])
    h.queue.add([file('e')], ['e'])
    await finish(h.tasks[4])
    expect(h.analyze.mock.calls.map(([file]) => file.name)).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(h.deliver.mock.calls.map(([id]) => id)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
  it('cancels one active file, skips removed queued files and ignores late results', async () => {
    const h = harness()
    h.queue.add([file('a'), file('b'), file('c')], ['a', 'b', 'c'])
    h.queue.remove('a'); h.queue.remove('c')
    expect(h.tasks[0].signal.aborted).toBe(true)
    expect(h.tasks[1].signal.aborted).toBe(false)
    await finish(h.tasks[0]); await finish(h.tasks[1])
    expect(h.analyze).toHaveBeenCalledTimes(2)
    expect(h.deliver.mock.calls.map(([id]) => id)).toEqual(['b'])
  })
  it('cannot resurrect cleared files when another upload starts before old work settles', async () => {
    const h = harness()
    h.queue.add([file('old')], ['old'])
    h.queue.clear(); h.queue.add([file('new')], ['new'])
    await finish(h.tasks[0]); await finish(h.tasks[1])
    expect(h.deliver.mock.calls.map(([id]) => id)).toEqual(['new'])
    h.queue.dispose(); h.queue.add([file('closed')], ['closed'])
    expect(h.analyze).toHaveBeenCalledTimes(2)
  })
  it('delivers a failure for one file and continues the next queued file', async () => {
    const deliver = vi.fn()
    const queue = new IncrementalAnalysis(async () => { throw new Error('failed') }, deliver, 1)
    queue.add([file('bad'), file('next')], ['bad', 'next'])
    await Promise.resolve(); await Promise.resolve()
    expect(deliver.mock.calls.map(([id, value]) => [id, value.code])).toEqual([['bad', 'processingFailed'], ['next', 'processingFailed']])
  })
})
