import { useEffect, useMemo, useState } from 'react'
import { Check, FolderArchive, LoaderCircle, Search, X } from 'lucide-react'
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

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    let items: AncPresetItem[] = []

    if (selectedVendor === 'all') {
      items = catalog.flatMap(group => group.items)
    } else {
      const group = catalog.find(g => g.vendor === selectedVendor)
      items = group ? group.items : []
    }

    if (!query) return items
    return items.filter(
      item =>
        item.name.toLowerCase().includes(query) ||
        item.vendor.toLowerCase().includes(query)
    )
  }, [catalog, selectedVendor, search])

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
      <div className="mobile-drawer-sheet" role="dialog" aria-modal="true" aria-labelledby="mobile-drawer-title">
        {/* Top Drag Handle */}
        <div className="mobile-drawer-handle-bar">
          <div className="mobile-drawer-handle" />
        </div>

        {/* Header */}
        <div className="mobile-drawer-header">
          <div className="mobile-drawer-title-wrap">
            <FolderArchive size={18} className="text-zinc-600" aria-hidden="true" />
            <h2 id="mobile-drawer-title" className="mobile-drawer-title">
              {text.presetLibrary}
            </h2>
          </div>
          <button
            type="button"
            className="mobile-drawer-close"
            onClick={onDismiss}
            aria-label={text.cancel}
          >
            <X size={20} />
          </button>
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

        {/* Vendor Chips (Horizontal Scroll) */}
        <div className="mobile-vendor-chips-wrap">
          <div className="mobile-vendor-chips">
            <button
              type="button"
              className={`mobile-vendor-chip ${selectedVendor === 'all' ? 'is-active' : ''}`}
              onClick={() => setSelectedVendor('all')}
            >
              {text.allVendors}
            </button>
            {catalog.map(group => (
              <button
                key={group.vendor}
                type="button"
                className={`mobile-vendor-chip ${selectedVendor === group.vendor ? 'is-active' : ''}`}
                onClick={() => setSelectedVendor(group.vendor)}
              >
                {group.vendor} ({group.items.length})
              </button>
            ))}
          </div>
        </div>

        {/* Item List */}
        <div className="mobile-drawer-list">
          {filteredItems.length === 0 ? (
            <div className="preset-empty-state">
              <p>{text.noPresetFound}</p>
            </div>
          ) : (
            filteredItems.map(item => {
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
            })
          )}
        </div>
      </div>
    </div>
  )
}
