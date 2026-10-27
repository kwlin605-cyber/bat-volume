import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Folder, LoaderCircle, Search, X } from 'lucide-react'
import { getAncCatalog, loadAncPresetFile, type AncPresetItem } from '../services/anc-catalog'
import { displayFileName } from '../lib/file-name'
import { text } from '../i18n/zh-TW'

interface Props {
  currentFileNames?: Set<string>
  onSelect: (file: File) => void
  onDismiss: () => void
}

export function MobilePresetDrawer({ currentFileNames = new Set(), onSelect, onDismiss }: Props) {
  const [selectedVendor, setSelectedVendor] = useState<string>('all')
  const [currentFolder, setCurrentFolder] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const catalog = useMemo(() => getAncCatalog(), [])

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onDismiss])

  // Prevent background scroll when drawer is open
  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [])

  const currentGroup = useMemo(() => {
    return catalog.find(g => g.vendor === selectedVendor)
  }, [catalog, selectedVendor])

  const { visibleFolders, visibleItems } = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (selectedVendor === 'all') {
      const direct = catalog.flatMap(group => group.directItems)
      const items = query
        ? direct.filter(
            item =>
              item.name.toLowerCase().includes(query) ||
              item.vendor.toLowerCase().includes(query)
          )
        : direct
      return { visibleFolders: [], visibleItems: items }
    }

    if (!currentGroup) return { visibleFolders: [], visibleItems: [] }

    if (currentFolder === null) {
      const folders = query
        ? currentGroup.folders.filter(f => f.name.toLowerCase().includes(query))
        : currentGroup.folders

      const items = query
        ? currentGroup.directItems.filter(item => item.name.toLowerCase().includes(query))
        : currentGroup.directItems

      return { visibleFolders: folders, visibleItems: items }
    } else {
      const folder = currentGroup.folders.find(f => f.name === currentFolder)
      const items = folder
        ? query
          ? folder.items.filter(item => item.name.toLowerCase().includes(query))
          : folder.items
        : []
      return { visibleFolders: [], visibleItems: items }
    }
  }, [catalog, selectedVendor, currentGroup, currentFolder, search])

  async function handleItemClick(item: AncPresetItem) {
    if (loadingId) return
    setLoadingId(item.id)
    try {
      const file = await loadAncPresetFile(item)
      onSelect(file)
      onDismiss()
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="mobile-drawer-overlay" onClick={e => { if (e.target === e.currentTarget) onDismiss() }}>
      <div className="mobile-drawer-sheet" role="dialog" aria-modal="true" aria-label={text.presetLibrary}>
        {/* Top Drag Handle */}
        <div className="mobile-drawer-handle-bar">
          <div className="mobile-drawer-handle" />
        </div>

        {/* Search */}
        <div className="mobile-drawer-search">
          <Search size={15} className="preset-search-icon" aria-hidden="true" />
          <input
            type="text"
            placeholder={text.searchPresetPlaceholder}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="preset-search-input"
            aria-label={text.searchPresetPlaceholder}
          />
          {search && (
            <button
              type="button"
              className="preset-search-clear"
              onClick={() => setSearch('')}
              aria-label={text.cancel}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Row 2: In-place swap between Vendor Chips and Folder Breadcrumb */}
        {currentFolder ? (
          <div className="mobile-breadcrumb-bar">
            <button
              type="button"
              className="mobile-breadcrumb-back"
              onClick={() => {
                setCurrentFolder(null)
                setSearch('')
              }}
            >
              <ChevronLeft size={18} aria-hidden="true" />
              <span>{text.backToVendor}</span>
              <span className="text-zinc-400">·</span>
              <span className="text-zinc-500">{selectedVendor}</span>
              <span className="text-zinc-400">/</span>
              <span className="font-semibold text-zinc-900">{currentFolder}</span>
            </button>
          </div>
        ) : (
          <div className="mobile-vendor-chips-wrap">
            <div className="mobile-vendor-chips">
              <button
                type="button"
                className={`mobile-vendor-chip ${selectedVendor === 'all' ? 'is-active' : ''}`}
                onClick={() => {
                  setSelectedVendor('all')
                  setCurrentFolder(null)
                  setSearch('')
                }}
              >
                {text.allVendors}
              </button>
              {catalog.map(group => (
                <button
                  key={group.vendor}
                  type="button"
                  className={`mobile-vendor-chip ${selectedVendor === group.vendor ? 'is-active' : ''}`}
                  onClick={() => {
                    setSelectedVendor(group.vendor)
                    setCurrentFolder(null)
                    setSearch('')
                  }}
                >
                  {group.vendor} ({group.items.length})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Item & Folder List */}
        <div className="mobile-drawer-list">
          {visibleFolders.length === 0 && visibleItems.length === 0 ? (
            <div className="preset-empty-state">
              <p>{text.noPresetFound}</p>
            </div>
          ) : (
            <>
              {/* Folder Items */}
              {visibleFolders.map(folder => (
                <button
                  key={folder.name}
                  type="button"
                  className="mobile-folder-item"
                  onClick={() => {
                    setCurrentFolder(folder.name)
                    setSearch('')
                  }}
                >
                  <div className="mobile-folder-left">
                    <Folder size={18} className="mobile-folder-icon" aria-hidden="true" />
                    <span className="mobile-folder-name">{folder.name}</span>
                  </div>
                  <div className="mobile-folder-right">
                    <span className="mobile-folder-count">{folder.items.length}</span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </div>
                </button>
              ))}

              {/* Bat Items */}
              {visibleItems.map(item => {
                const isAdded = currentFileNames.has(item.name)
                const isLoading = loadingId === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`mobile-model-item ${isAdded ? 'is-added' : ''}`}
                    disabled={isLoading}
                    onClick={() => handleItemClick(item)}
                  >
                    <div className="mobile-model-info">
                      {selectedVendor === 'all' && (
                        <span className="mobile-model-vendor">{item.vendor}</span>
                      )}
                      <span className="mobile-model-name">{displayFileName(item.name)}</span>
                    </div>
                    <div className="mobile-model-status">
                      {isAdded && (
                        <span className="preset-added-pill">
                          <Check size={11} aria-hidden="true" />
                          {text.addedBadge}
                        </span>
                      )}
                      {isLoading && (
                        <LoaderCircle size={15} className="spin text-zinc-500" aria-hidden="true" />
                      )}
                    </div>
                  </button>
                )
              })}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
