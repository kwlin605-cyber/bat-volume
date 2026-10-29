import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronLeft, Folder, FolderArchive, Search, X } from 'lucide-react'
import { getAncCatalog, type AncPresetItem } from '../services/anc-catalog'
import { displayFileName } from '../lib/file-name'
import { text } from '../i18n/zh-TW'

interface Props {
  currentPresetIds?: ReadonlySet<string>
  onSelect: (preset: AncPresetItem) => void
  onRemovePreset?: (id: string) => void
  onDismiss: () => void
}

export function PresetLibraryDialog({ currentPresetIds = new Set(), onSelect, onRemovePreset, onDismiss }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [selectedVendor, setSelectedVendor] = useState<string>('all')
  const [currentFolder, setCurrentFolder] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const catalog = useMemo(() => getAncCatalog(), [])

  useEffect(() => {
    if (dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal()
    }
  }, [])

  const currentGroup = useMemo(() => {
    return catalog.find(g => g.vendor === selectedVendor)
  }, [catalog, selectedVendor])

  const { visibleFolders, visibleItems } = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (selectedVendor === 'all') {
      // In all vendors: only show direct items with vendor tag
      const direct = catalog.flatMap(g => g.directItems)
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
      // At vendor root: show subfolders and direct items
      const folders = query
        ? currentGroup.folders.filter(f => f.name.toLowerCase().includes(query))
        : currentGroup.folders

      const items = query
        ? currentGroup.directItems.filter(item => item.name.toLowerCase().includes(query))
        : currentGroup.directItems

      return { visibleFolders: folders, visibleItems: items }
    } else {
      // Inside subfolder
      const folder = currentGroup.folders.find(f => f.name === currentFolder)
      const items = folder
        ? query
          ? folder.items.filter(item => item.name.toLowerCase().includes(query))
          : folder.items
        : []
      return { visibleFolders: [], visibleItems: items }
    }
  }, [catalog, selectedVendor, currentGroup, currentFolder, search])

  const totalCount = useMemo(() => {
    if (selectedVendor === 'all') {
      return catalog.reduce((acc, g) => acc + g.directItems.length, 0)
    }
    return currentGroup?.items.length ?? 0
  }, [catalog, selectedVendor, currentGroup])

  function handleItemClick(item: AncPresetItem) {
    if (currentPresetIds.has(item.id) && onRemovePreset) {
      onRemovePreset(item.id)
      return
    }
    onSelect(item)
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
            <FolderArchive size={20} className="text-[color:var(--ui-controlIcon)]" aria-hidden="true" />
            <h2 id="preset-dialog-title" className="preset-dialog-title">
              {text.presetLibrary}
            </h2>
            <span className="preset-dialog-counter">
              {visibleFolders.length + visibleItems.length} / {totalCount}
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
              onClick={() => {
                setSelectedVendor('all')
                setCurrentFolder(null)
                setSearch('')
              }}
            >
              <span>{text.allVendors}</span>
              <span className="preset-badge">{totalCount}</span>
            </button>
            {catalog.map(group => (
              <button
                key={group.vendor}
                type="button"
                className={`preset-vendor-tab ${selectedVendor === group.vendor ? 'is-active' : ''}`}
                onClick={() => {
                  setSelectedVendor(group.vendor)
                  setCurrentFolder(null)
                  setSearch('')
                }}
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

            {/* Breadcrumb when inside subfolder */}
            {currentFolder && (
              <div className="preset-breadcrumb-bar">
                <button
                  type="button"
                  className="preset-breadcrumb-btn"
                  onClick={() => {
                    setCurrentFolder(null)
                    setSearch('')
                  }}
                  title={text.backToVendor}
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                  <span>{selectedVendor}</span>
                  <span className="text-[color:var(--ui-controlHint)]">/</span>
                  <span className="font-semibold text-[color:var(--ui-controlStrong)]">{currentFolder}</span>
                </button>
              </div>
            )}

            <div className="preset-grid-scroll">
              {visibleFolders.length === 0 && visibleItems.length === 0 ? (
                <div className="preset-empty-state">
                  <p>{text.noPresetFound}</p>
                </div>
              ) : (
                <div className="preset-cards-grid">
                  {/* Folder Cards */}
                  {visibleFolders.map(folder => (
                    <button
                      key={folder.name}
                      type="button"
                      className="preset-card preset-card-folder"
                      onClick={() => {
                        setCurrentFolder(folder.name)
                        setSearch('')
                      }}
                    >
                      <div className="preset-card-header">
                        <span className="preset-folder-tag">
                          <Folder size={13} aria-hidden="true" />
                          <span>{text.folderBadge}</span>
                        </span>
                        <span className="preset-badge">{folder.items.length}</span>
                      </div>
                      <div className="preset-card-name font-semibold" title={folder.name}>
                        {folder.name}
                      </div>
                    </button>
                  ))}

                  {/* Bat Item Cards */}
                  {visibleItems.map(item => {
                    const isAdded = currentPresetIds.has(item.id)
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`preset-card ${isAdded ? 'is-added' : ''}`}
                        aria-pressed={isAdded}
                        onClick={() => handleItemClick(item)}
                      >
                        <div className="preset-card-header">
                          {selectedVendor === 'all' && (
                            <span className="preset-vendor-tag">{item.vendor}</span>
                          )}
                          {isAdded && (
                            <span className="preset-added-pill">
                              <Check size={11} aria-hidden="true" />
                              {text.addedBadge}
                            </span>
                          )}
                        </div>
                        <div className="preset-card-name" title={displayFileName(item.name)}>
                          {displayFileName(item.name)}
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
