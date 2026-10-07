import { afterEach, describe, expect, it, vi } from 'vitest'
import { analyzeFile } from '../src/services/analyze-file'

afterEach(() => vi.unstubAllGlobals())
describe('analysis worker lifecycle', () => {
  it('does not create a worker when file reading completes after cancellation', async () => {
    let resolve!: (value: ArrayBuffer) => void
    const file = new File(['G1'], 'bat.anc')
    vi.spyOn(file, 'arrayBuffer').mockImplementation(() => new Promise(r => { resolve = r }))
    const worker = vi.fn()
    vi.stubGlobal('Worker', worker)
    const controller = new AbortController()
    const analysis = analyzeFile(file, controller.signal)
    controller.abort(); resolve(new ArrayBuffer(0))
    await expect(analysis).rejects.toMatchObject({ name: 'AbortError' })
    expect(worker).not.toHaveBeenCalled()
  })
  it('terminates an active worker when cancelled', async () => {
    const terminate = vi.fn(), postMessage = vi.fn()
    vi.stubGlobal('Worker', class { terminate = terminate; postMessage = postMessage })
    const controller = new AbortController()
    const analysis = analyzeFile(new File(['G1'], 'bat.anc'), controller.signal)
    await vi.waitFor(() => expect(postMessage).toHaveBeenCalledOnce())
    controller.abort()
    await expect(analysis).rejects.toMatchObject({ name: 'AbortError' })
    expect(terminate).toHaveBeenCalledOnce()
  })
  it('rejects unsupported files before allocating a worker', async () => {
    const worker = vi.fn(); vi.stubGlobal('Worker', worker)
    expect(await analyzeFile(new File(['G1'], 'bat.txt'), new AbortController().signal)).toMatchObject({ status: 'undetermined', code: 'wrongFileType' })
    expect(worker).not.toHaveBeenCalled()
  })
})
