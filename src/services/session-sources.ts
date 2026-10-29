import { getAncCatalog, loadAncPresetFile, type AncPresetItem } from './anc-catalog'
import type { AnalysisSource } from './analysis-state'
import type { SessionFile } from './batch-session'

/** Catalog references always resolve against this build; uploads retain their saved bytes. */
export function sessionSources(files: readonly SessionFile[], catalog: readonly AncPresetItem[] = getAncCatalog().flatMap(group => group.items)): AnalysisSource[] {
  const presets = new Map(catalog.map(item => [item.id, item]))
  return files.map(item => ({
    id: item.id, origin: item.origin, source: { name: item.name, size: item.blob?.size ?? 0 },
    load: async () => {
      if (item.origin?.kind === 'preset') {
        const preset = presets.get(item.origin.id)
        return preset ? loadAncPresetFile(preset) : null
      }
      return new File([item.blob!], item.name, { type: item.blob!.type, lastModified: item.lastModified })
    },
  }))
}
