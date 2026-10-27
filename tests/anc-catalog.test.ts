import { describe, expect, it } from 'vitest'
import { getAncCatalog, loadAncPresetFile } from '../src/services/anc-catalog'
import { createBatchSession, appendSessionFiles } from '../src/services/batch-session'
import { parseAnc } from '../src/domain/anc/parser'

describe('ANC preset catalog and on-demand loader', () => {
  it('automatically discovers vendor directories and lists ANC files', () => {
    const catalog = getAncCatalog()
    expect(catalog.length).toBeGreaterThan(0)

    for (const group of catalog) {
      expect(group.vendor).toBeTruthy()
      expect(group.items.length).toBeGreaterThan(0)
      expect(group.directItems.length + group.folders.reduce((acc, f) => acc + f.items.length, 0)).toBe(group.items.length)
      for (const folder of group.folders) {
        expect(folder.name).toBeTruthy()
        expect(folder.items.length).toBeGreaterThan(0)
        for (const fItem of folder.items) {
          expect(fItem.folder).toBe(folder.name)
        }
      }
      for (const item of group.items) {
        expect(item.id).toMatch(/^\/src\/assets\/anc\//)
        expect(item.name.endsWith('.anc')).toBe(true)
        expect(typeof item.load).toBe('function')
      }
    }
  })

  it('asynchronously loads raw ANC content and produces a standard File object', async () => {
    const catalog = getAncCatalog()
    expect(catalog.length).toBeGreaterThan(0)
    const firstGroup = catalog[0]
    const item = firstGroup.items[0]

    const file = await loadAncPresetFile(item)
    expect(file).toBeInstanceOf(File)
    expect(file.name).toBe(item.name)
    expect(file.type).toBe('text/plain')

    const text = await file.text()
    expect(text.length).toBeGreaterThan(100)
    expect(text).toContain('G')

    // Verifies that the raw text successfully parses through the domain G-code parser
    const program = parseAnc(text)
    expect(program.sweeps.length).toBeGreaterThan(0)
  })

  it('integrates seamlessly with batch session without pipeline breakage', async () => {
    const catalog = getAncCatalog()
    const firstItem = catalog[0].items[0]
    const file = await loadAncPresetFile(firstItem)

    // Creates batch session as if user uploaded it
    const session = createBatchSession([file])
    expect(session.files).toHaveLength(1)
    expect(session.files[0].name).toBe(firstItem.name)
    expect(session.files[0].blob).toBe(file)

    // Can append another preset
    if (catalog[1]?.items[0]) {
      const secondFile = await loadAncPresetFile(catalog[1].items[0])
      const updated = appendSessionFiles(session, [secondFile])
      expect(updated.files).toHaveLength(2)
      expect(updated.files[1].name).toBe(catalog[1].items[0].name)
    }
  })
})
