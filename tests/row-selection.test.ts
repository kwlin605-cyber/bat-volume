import { describe, expect, it } from 'vitest'
import { clickRowSelection, selectRowRange } from '../src/features/batch/row-selection'
import { createBatchSession, updateSessionRequirements } from '../src/services/batch-session'
import { LatestSessionStorage, type SessionRepository } from '../src/services/latest-session-storage'

describe('row range selection and atomic requirements', () => {
  const rows = [{ id: 'z', pending: false }, { id: 'loading', pending: true }, { id: 'a', pending: false }, { id: 'duplicate-name', pending: false }]
  it('selects both directions in visual order, skipping pending rows and retaining identities', () => {
    expect(selectRowRange(rows, 'z', 'a')).toEqual(['z', 'a'])
    expect(selectRowRange(rows, 'a', 'z')).toEqual(['z', 'a'])
    expect(selectRowRange([...rows].reverse(), 'z', 'a')).toEqual(['a', 'z'])
    expect(selectRowRange(rows, 'a', 'a')).toEqual(['a'])
    expect(selectRowRange(rows, 'unknown', 'a')).toEqual([])
  })
  it('plain clicks replace selection while Ctrl toggles separate rows without changing requirements', () => {
    const plain = { ctrlKey: false, shiftKey: false }, ctrl = { ctrlKey: true, shiftKey: false }
    let selected = clickRowSelection(rows, { ids: [], anchor: null }, 'z', plain)
    selected = clickRowSelection(rows, selected, 'duplicate-name', ctrl)
    expect(selected.ids).toEqual(['z', 'duplicate-name'])
    selected = clickRowSelection(rows, selected, 'z', ctrl)
    expect(selected.ids).toEqual(['duplicate-name'])
    expect(clickRowSelection(rows, selected, 'a', plain)).toEqual({ ids: ['a'], anchor: 'a' })
    expect(clickRowSelection(rows, selected, 'loading', ctrl)).toBe(selected)
    expect(clickRowSelection(rows, selected, 'duplicate-name', ctrl).ids).toEqual([])
  })
  it('keeps the original Shift anchor when expanding or shortening a range', () => {
    const shift = { ctrlKey: false, shiftKey: true }
    const initial = { ids: ['z'], anchor: 'z' }
    const extended = clickRowSelection(rows, initial, 'duplicate-name', shift)
    expect(extended).toEqual({ ids: ['z', 'a', 'duplicate-name'], anchor: 'z' })
    expect(clickRowSelection(rows, extended, 'a', shift)).toEqual({ ids: ['z', 'a'], anchor: 'z' })
    expect(clickRowSelection([...rows].reverse(), initial, 'a', shift).ids).toEqual(['a', 'z'])
    expect(clickRowSelection(rows, { ids: [], anchor: 'removed' }, 'a', shift)).toEqual({ ids: ['a'], anchor: 'a' })
  })
  it('Ctrl + Shift adds a range without dropping unrelated selections', () => {
    const selected = { ids: ['z', 'duplicate-name'], anchor: 'duplicate-name' }
    expect(clickRowSelection(rows, selected, 'a', { ctrlKey: true, shiftKey: true })).toEqual({ ids: ['z', 'a', 'duplicate-name'], anchor: 'duplicate-name' })
    expect(clickRowSelection(rows, selected, 'a', { ctrlKey: false, shiftKey: true })).toEqual({ ids: ['a', 'duplicate-name'], anchor: 'duplicate-name' })
  })
  it('updates only selected live files, preserving unrelated targets, ANC bytes and display', () => {
    const session = createBatchSession([new File(['one'], 'same.anc'), new File(['two'], 'same.anc'), new File(['three'], 'other.anc')])
    const ids = session.files.map(file => file.id)
    session.requirements = { [ids[0]]: { min: 600, max: 650 }, [ids[2]]: { min: 800, max: 850 } }
    const next = updateSessionRequirements(session, [ids[0], ids[1], ids[0], 'removed'], { min: 700, max: 700 })
    expect(next.requirements).toEqual({ [ids[0]]: { min: 700, max: 700 }, [ids[1]]: { min: 700, max: 700 }, [ids[2]]: { min: 800, max: 850 } })
    expect(session.requirements[ids[0]]).toEqual({ min: 600, max: 650 })
    expect(next.files).toBe(session.files)
    expect(next.display).toBe(session.display)
    expect(updateSessionRequirements(session, ids, { min: 750, max: 700 })).toBe(session)
    expect(updateSessionRequirements(session, ['removed'], { min: 700, max: 750 })).toBe(session)
    expect(updateSessionRequirements(next, [ids[0]], null).requirements[ids[1]]).toEqual({ min: 700, max: 700 })
  })
  it('persists a complete multi-file update once and restores the whole group together', async () => {
    let saved = createBatchSession([new File(['one'], 'one.anc'), new File(['two'], 'two.anc')]), writes = 0
    const repository: SessionRepository = {
      read: async () => saved,
      replace: async value => { saved = value },
      updateRequirements: async (id, values) => { if (id === saved.id) { saved = { ...saved, requirements: values }; writes++ } },
      updateDisplay: async () => {}, clear: async () => {},
    }
    const storage = new LatestSessionStorage(repository)
    const next = updateSessionRequirements(saved, saved.files.map(file => file.id), { min: 600, max: 650 })
    await storage.updateRequirements(next.id, next.requirements)
    expect(writes).toBe(1)
    expect((await storage.read())!.requirements).toEqual(next.requirements)
  })
})
