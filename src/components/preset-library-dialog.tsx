import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, FolderArchive, LoaderCircle, Search, X } from 'lucide-react'
import { getAncCatalog, loadAncPresetFile, type AncPresetItem } from '../services/anc-catalog'
import { text } from '../i18n/zh-TW'

interface Props {
  currentFileNames?: Set<string>
  onSelect: (file: File) => void
  onDismiss: () => void
}

export function PresetLibraryDialog({ currentFileNames = new Set(), onSelect, onDismiss }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [selectedVendor, setSelectedVendor] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const catalog = useMemo(() => getAncCatalog(), [])

  useEffect(() => {
    if (dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal()
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

  const totalCount = useMemo(() => catalog.reduce((acc, g) => acc + g.items.length, 0), [catalog])

  async function handleItemClick(item: AncPresetItem) {
    if (loadingId) return
    setLoadingId(item.id)
    try {
      const file = await loadAncPresetFile(item)
      onSelect(file)
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="preset-dialog"
      aria-labelledby="preset-dialog-title"
      onClose={onDismiss}
      onClick={e => {
        if (e.target === e.currentTarget) dialogRef.current?.close()
      }}
    >
      <div className="preset-dialog-container">
        {/* Header */}
        <div className="preset-dialog-header">
          <div className="preset-dialog-title-wrap">
            <FolderArchive size={20} className="text-zinc-600" aria-hidden="true" />
            <h2 id="preset-dialog-title" className="preset-dialog-title">
              {text.presetLibrary}
            </h2>
            <span className="preset-dialog-counter">
              {filteredItems.length} / {totalCount}
            </span>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label={text.cancel}
            onClick={() => dialogRef.current?.close()}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body: Dual column layout */}
        <div className="preset-dialog-body">
          {/* Left: Vendors Sidebar */}
          <nav className="preset-vendor-sidebar" aria-label={text.allVendors}>
            <button
              type="button"
              className={`preset-vendor-tab ${selectedVendor === 'all' ? 'is-active' : ''}`}
              onClick={() => setSelectedVendor('all')}
            >
              <span>{text.allVendors}</span>
              <span className="preset-badge">{totalCount}</span>
            </button>
            {catalog.map(group => (
              <button
                key={group.vendor}
                type="button"
                className={`preset-vendor-tab ${selectedVendor === group.vendor ? 'is-active' : ''}`}
                onClick={() => setSelectedVendor(group.vendor)}
              >
                <span>{group.vendor}</span>
                <span className="preset-badge">{group.items.length}</span>
              </button>
            ))}
          </nav>

          {/* Right: Search & Items */}
          <div className="preset-items-pane">
            <div className="preset-search-box">
              <Search size={16} className="preset-search-icon" aria-hidden="true" />
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

            <div className="preset-grid-scroll">
              {filteredItems.length === 0 ? (
                <div className="preset-empty-state">
                  <p>{text.noPresetFound}</p>
                </div>
              ) : (
                <div className="preset-cards-grid">
                  {filteredItems.map(item => {
                    const isAdded = currentFileNames.has(item.name)
                    const isLoading = loadingId === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`preset-card ${isAdded ? 'is-added' : ''}`}
                        disabled={isLoading}
                        onClick={() => handleItemClick(item)}
                      >
                        <div className="preset-card-header">
                          <span className="preset-vendor-tag">{item.vendor}</span>
                          {isAdded && (
                            <span className="preset-added-pill">
                              <Check size={11} aria-hidden="true" />
                              {text.addedBadge}
                            </span>
                          )}
                          {isLoading && (
                            <LoaderCircle size={14} className="spin text-zinc-500" aria-hidden="true" />
                          )}
                        </div>
                        <div className="preset-card-name" title={item.name}>
                          {item.name}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </dialog>
  )
}
