export interface AncPresetItem {
  id: string
  vendor: string
  name: string
  load: () => Promise<string>
}

export interface AncVendorGroup {
  vendor: string
  items: AncPresetItem[]
}

/**
 * Vite compile-time glob for all vendor-classified ANC files.
 * Uses lazy loading so raw G-code text is only downloaded over the network
 * when the user explicitly chooses that bat model.
 */
const presetModules = import.meta.glob<string>('/src/assets/anc/*/*.anc', {
  query: '?raw',
  import: 'default',
})

let cachedCatalog: AncVendorGroup[] | null = null

export function getAncCatalog(): AncVendorGroup[] {
  if (cachedCatalog) return cachedCatalog

  const map = new Map<string, AncPresetItem[]>()

  for (const [path, loader] of Object.entries(presetModules)) {
    // Expected path format: /src/assets/anc/<vendor>/<filename>.anc
    const normalized = path.replace(/\\/g, '/')
    const parts = normalized.split('/')
    const filename = parts.pop() ?? ''
    const vendor = parts.pop() ?? ''

    if (!vendor || !filename) continue

    const item: AncPresetItem = {
      id: path,
      vendor,
      name: filename,
      load: loader,
    }

    const group = map.get(vendor)
    if (group) {
      group.push(item)
    } else {
      map.set(vendor, [item])
    }
  }

  // Sort vendors and models predictably
  const groups: AncVendorGroup[] = Array.from(map.entries())
    .map(([vendor, items]) => ({
      vendor,
      items: items.sort((a, b) => a.name.localeCompare(b.name, 'zh-TW', { numeric: true })),
    }))
    .sort((a, b) => a.vendor.localeCompare(b.vendor, 'zh-TW'))

  cachedCatalog = groups
  return groups
}

/**
 * Lazily loads the raw content of the selected preset ANC file
 * and packages it into a native standard File object so it passes
 * seamlessly into the existing calculation pipeline and IndexedDB caching.
 */
export async function loadAncPresetFile(preset: AncPresetItem): Promise<File> {
  const content = await preset.load()
  return new File([content], preset.name, {
    type: 'text/plain',
    lastModified: Date.now(),
  })
}
