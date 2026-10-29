import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { analyzeAnc } from '../src/domain/analyze'
import { appendSessionFiles, appendSessionPreset, createBatchSession, removeSessionFile, restoreBatchSession, updateSessionRequirements } from '../src/services/batch-session'
import { getAncCatalog, presetOrigin, type AncPresetItem } from '../src/services/anc-catalog'
import { sessionSources } from '../src/services/session-sources'
import { IncrementalAnalysis } from '../src/services/incremental-analysis'
import type { AnalysisEntry, AnalysisOutcome, AnalysisSource } from '../src/services/analysis-state'
import { allMetricIds } from '../src/features/batch/columns'
import { buildBatchView } from '../src/features/batch/view-model'
import { text } from '../src/i18n/zh-TW'

const raw = readFileSync(new URL('./fixtures/case-001.anc', import.meta.url), 'utf8')
const changed = raw.replace(/Z(-?\d+(?:\.\d+)?)/g, (_, z) => `Z${Number(z) * 1.1}`)
const catalogItem = (vendor: string, folder?: string): AncPresetItem => ({
  id: `/src/assets/anc/${vendor}/${folder ? `${folder}/` : ''}same.anc`, vendor, folder, name: 'same.anc', load: async () => raw,
})
const first = catalogItem('甲'), second = catalogItem('乙'), nested = catalogItem('甲', '資料夾')
async function run(sources: AnalysisSource[], width = 5) {
  const delivered: AnalysisEntry[] = []
  await new Promise<void>(resolve => {
    const queue = new IncrementalAnalysis(async file => analyzeAnc(await file.text(), { name: file.name, size: file.size }, undefined, undefined, width), (id, result) => {
      delivered.push({ id, source: result.source, origin: sources.find(source => source.id === id)?.origin, state: result.status === 'unavailable' ? result : { status: 'result', result } })
      if (delivered.length === sources.length) resolve()
    })
    queue.add(sources, sources.map(source => source.id), width)
  })
  return delivered
}

describe('saved source identity and current-build loading', () => {
  it('keeps same-name vendors, folders and manual uploads independent, deduplicating only the same preset', () => {
    let session = appendSessionPreset(null, first.name, presetOrigin(first))
    const id = session.files[0].id
    session = updateSessionRequirements(session, [id], { min: 800.123, max: 850.456 })
    expect(appendSessionPreset(session, first.name, presetOrigin(first))).toBe(session)
    session = appendSessionPreset(session, second.name, presetOrigin(second))
    session = appendSessionPreset(session, nested.name, presetOrigin(nested))
    session = appendSessionFiles(session, [new File([raw], 'same.anc')])
    expect(new Set(session.files.map(item => item.id)).size).toBe(4)
    expect(session.files.slice(0, 3).every(item => item.blob === undefined)).toBe(true)
    expect(session.files[2].origin).toMatchObject({ label: '甲／資料夾' })
    const remaining = removeSessionFile(session, session.files[1].id)!
    expect(remaining.files.map(item => item.id)).toContain(id)
    expect(remaining.files.map(item => item.id)).not.toContain(session.files[1].id)
    expect(remaining.requirements[id]).toEqual({ min: 800.123, max: 850.456 })
  })

  it('restores references and targets, then reads updated content for the same path and reanalyzes with the selected blade width', async () => {
    const session = appendSessionPreset(null, first.name, presetOrigin(first))
    const original = await run(sessionSources(session.files, [first]))
    const id = session.files[0].id
    const restored = restoreBatchSession(structuredClone({ version: 2, id: session.id, files: session.files }), { sessionId: session.id, values: { [id]: { min: 800, max: 850 } } })!
    const loader = vi.fn(async () => changed)
    const updatedItem = { ...first, load: loader }
    const updated = await run(sessionSources(restored.files, [updatedItem]))
    expect(loader).toHaveBeenCalledOnce()
    expect(updated[0].id).toBe(id)
    expect(updated[0].origin).toEqual(presetOrigin(first))
    const before = original[0].state, after = updated[0].state
    if (before.status !== 'result' || before.result.status !== 'calculated' || after.status !== 'result' || after.result.status !== 'calculated') throw new Error('Expected calculated geometry')
    expect(after.result.volumeCm3).toBeGreaterThan(before.result.volumeCm3)
    const noBlade = await run(sessionSources(restored.files, [updatedItem]), 0)
    if (noBlade[0].state.status !== 'result' || noBlade[0].state.result.status !== 'calculated') throw new Error('Expected calculated geometry')
    expect(noBlade[0].state.result.volumeCm3).not.toBe(after.result.volumeCm3)
    expect(restored.requirements[id]).toEqual({ min: 800, max: 850 })
  })

  it('does not substitute a same-name file when the exact preset is removed, and preserves independent uploads', async () => {
    let session = appendSessionPreset(null, first.name, presetOrigin(first))
    session = appendSessionFiles(session, [new File([raw], first.name)])
    const load = vi.fn(second.load)
    const entries = await run(sessionSources(session.files, [{ ...second, load }]))
    expect(load).not.toHaveBeenCalled()
    expect(entries.find(entry => entry.id === session.files[0].id)!.state).toMatchObject({ status: 'unavailable', reason: 'presetRemoved' })
    expect(entries.find(entry => entry.id === session.files[1].id)!.state).toMatchObject({ status: 'result', result: { status: 'calculated' } })
    const view = buildBatchView(entries, allMetricIds, { key: 'name', direction: 'asc' })
    const missing = view.rows.find(row => row.id === session.files[0].id)!
    expect(missing.status.detail).toBe(text.presetRemoved)
    expect(Object.values(missing.cells).every(cell => cell.value === null)).toBe(true)
  })

  it('reports a failed download without using saved bytes and continues other files', async () => {
    let session = appendSessionPreset(null, first.name, presetOrigin(first))
    session = appendSessionFiles(session, [new File([raw], first.name)])
    const entries = await run(sessionSources(session.files, [{ ...first, load: async () => { throw new Error('offline') } }]))
    expect(entries.find(entry => entry.id === session.files[0].id)!.state).toMatchObject({ status: 'unavailable', reason: 'presetLoadFailed' })
    expect(entries.find(entry => entry.id === session.files[1].id)!.state).toMatchObject({ status: 'result', result: { status: 'calculated' } })
  })

  it('preserves version-one bytes, identities, targets and display without guessing a matching catalog origin', async () => {
    const original = createBatchSession([new File([raw], first.name)])
    const legacyFiles = original.files.map(({ origin: _, ...file }) => file)
    const restored = restoreBatchSession(structuredClone({ version: 1, id: original.id, files: legacyFiles }), { sessionId: original.id, values: { [legacyFiles[0].id]: { min: 800, max: 800 } } }, { version: 1, sessionId: original.id, value: { visible: ['volume'] } })!
    const load = vi.fn(async () => changed)
    const sources = sessionSources(restored.files, [{ ...first, load }])
    expect(await (await sources[0].load())!.text()).toBe(raw)
    expect(load).not.toHaveBeenCalled()
    expect(sources[0].origin).toBeUndefined()
    expect(restored.files[0].id).toBe(legacyFiles[0].id)
    expect(restored.display.visible).toEqual(['volume'])
    expect(restored.requirements[legacyFiles[0].id]).toEqual({ min: 800, max: 800 })
    expect(appendSessionPreset(restored, first.name, presetOrigin(first)).files).toHaveLength(2)
  })

  it('rejects invalid references rather than silently treating them as saved uploads', () => {
    const original = appendSessionPreset(null, first.name, presetOrigin(first))
    const stored = { version: 2, id: original.id, files: original.files }
    for (const corrupt of [{ ...original.files[0], origin: { kind: 'preset', id: '', label: '甲' } }, { ...original.files[0], blob: new Blob([raw]) }, { ...original.files[0], origin: { kind: 'unknown' } }]) {
      expect(() => restoreBatchSession({ ...stored, files: [corrupt] }, null)).toThrow()
    }
  })

  it('uses real catalog paths to distinguish a vendor root from its same-name subfolder', () => {
    const matches = getAncCatalog().flatMap(group => group.items).filter(item => item.name === 'X-56-860.anc' && item.vendor === '劉')
    expect(matches).toHaveLength(2)
    expect(new Set(matches.map(item => presetOrigin(item).label))).toEqual(new Set(['劉', '劉／未重新命名']))
  })
})

describe('catalog loading belongs to the cancelable bounded analysis queue', () => {
  it.each(['remove', 'clear', 'dispose'] as const)('never analyzes or delivers a late file after %s', async action => {
    let resolve!: (file: File) => void
    const source: AnalysisSource = { id: 'old', source: { name: 'same.anc', size: 0 }, load: () => new Promise(yes => { resolve = yes }) }
    const analyze = vi.fn(async () => analyzeAnc(raw, source.source))
    const deliver = vi.fn()
    const queue = new IncrementalAnalysis(analyze, deliver, 1)
    queue.add([source], ['old'])
    if (action === 'remove') queue.remove('old')
    else queue[action]()
    resolve(new File([raw], 'same.anc'))
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(analyze).not.toHaveBeenCalled()
    expect(deliver).not.toHaveBeenCalled()
  })

  it('bounds downloads as well as analysis, and a canceled old generation cannot replace the same ID', async () => {
    let resolve!: (file: File) => void
    const old: AnalysisSource = { id: 'bat', source: { name: 'old.anc', size: 0 }, load: () => new Promise(yes => { resolve = yes }) }
    const next: AnalysisSource = { ...old, source: { name: 'new.anc', size: 0 }, load: vi.fn(async () => new File([raw], 'new.anc')) }
    const deliver = vi.fn<(id: string, result: AnalysisOutcome) => void>()
    const queue = new IncrementalAnalysis(async file => analyzeAnc(await file.text(), { name: file.name, size: file.size }), deliver, 1)
    queue.add([old], ['bat'])
    queue.clear(); queue.add([next], ['bat'])
    expect(next.load).not.toHaveBeenCalled()
    resolve(new File([raw], 'old.anc'))
    await vi.waitFor(() => expect(deliver).toHaveBeenCalledOnce())
    expect(deliver.mock.calls[0][1].source.name).toBe('new.anc')
  })
})
