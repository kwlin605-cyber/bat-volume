export interface AncPresetItem {
  id: string
  vendor: string
  series?: string
  folder?: string
  name: string
  load: () => Promise<string>
}

export interface AncVendorFolder {
  name: string
  items: AncPresetItem[]
}

export interface AncVendorGroup {
  vendor: string
  items: AncPresetItem[]
  directItems: AncPresetItem[]
  folders: AncVendorFolder[]
}

/**
 * Vite compile-time glob for all vendor-classified ANC files.
 * Uses lazy loading so raw G-code text is only downloaded over the network
 * when the user explicitly chooses that bat model.
 */
const presetModules = import.meta.glob<string>('/src/assets/anc/**/*.anc', {
  query: '?raw',
  import: 'default',
})

let cachedCatalog: AncVendorGroup[] | null = null

export function getAncCatalog(): AncVendorGroup[] {
  if (cachedCatalog) return cachedCatalog

  interface VendorCollector {
    items: AncPresetItem[]
    directItems: AncPresetItem[]
    folderMap: Map<string, AncPresetItem[]>
  }

  const map = new Map<string, VendorCollector>()

  for (const [path, loader] of Object.entries(presetModules)) {
    // Expected path format: /src/assets/anc/<vendor>/[<series>/.../]<filename>.anc
    const normalized = path.replace(/\\/g, '/')
    const rel = normalized.replace(/^\/src\/assets\/anc\//, '')
    const parts = rel.split('/')
    if (parts.length < 2) continue

    const vendor = parts[0]
    if (!vendor) continue

    let series: string | undefined = undefined
    let displayName = ''

    if (parts.length === 2) {
      // 只有兩層: anc / vendor / file.anc
      displayName = parts[1]
    } else if (parts.length === 3) {
      // 標準三層: anc / vendor / series / file.anc
      series = parts[1]
      displayName = parts[2]
    } else {
      // 三層以上: anc / vendor / series / ... / file.anc
      series = parts[1]
      displayName = parts.slice(2).join(' / ')
    }

    const item: AncPresetItem = {
      id: path,
      vendor,
      series,
      folder: series,
      name: displayName,
      load: loader,
    }

    let collector = map.get(vendor)
    if (!collector) {
      collector = {
        items: [],
        directItems: [],
        folderMap: new Map(),
      }
      map.set(vendor, collector)
    }

    collector.items.push(item)

    if (series) {
      let folderList = collector.folderMap.get(series)
      if (!folderList) {
        folderList = []
        collector.folderMap.set(series, folderList)
      }
      folderList.push(item)
    } else {
      collector.directItems.push(item)
    }
  }

  // Sort vendors, models and folders predictably
  const groups: AncVendorGroup[] = Array.from(map.entries())
    .map(([vendor, collector]) => {
      const folders: AncVendorFolder[] = Array.from(collector.folderMap.entries())
        .map(([folderName, folderItems]) => ({
          name: folderName,
          items: folderItems.sort((a, b) => a.name.localeCompare(b.name, 'zh-TW', { numeric: true })),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-TW'))

      return {
        vendor,
        items: collector.items.sort((a, b) => a.name.localeCompare(b.name, 'zh-TW', { numeric: true })),
        directItems: collector.directItems.sort((a, b) => a.name.localeCompare(b.name, 'zh-TW', { numeric: true })),
        folders,
      }
    })
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
