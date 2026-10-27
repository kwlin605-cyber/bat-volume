import { useRef, useState } from 'react'
import { FileUp, FolderArchive, LoaderCircle, Plus, ShieldCheck } from 'lucide-react'
import { Button } from './components/ui/button'
import BatchResults from './features/batch/batch-results'
import { useBatchSession } from './hooks/use-batch-session'
import { FileActions } from './components/file-actions'
import { useDiameterAllowance } from './hooks/use-diameter-allowance'
import { useDesktop } from './hooks/use-desktop'
import { useMaterialSettings } from './features/batch/use-material-settings'
import { useWeightUnit } from './features/batch/use-weight-unit'
import { useLengthUnit } from './features/batch/use-length-unit'
import { MaterialDialog } from './features/batch/material-dialog'
import { PresetLibraryDialog } from './components/preset-library-dialog'
import { MobilePresetDrawer } from './components/mobile-preset-drawer'
import { MobileResultView } from './components/mobile-result-view'
import { text } from './i18n/zh-TW'

export default function App() {
  const input = useRef<HTMLInputElement>(null)
  const {
    entries,
    requirements,
    display,
    sort,
    restoring,
    storageUnavailable,
    addFiles,
    removeFile,
    clearFiles,
    setFileRequirements,
    updateDisplay,
    updateSort,
  } = useBatchSession()

  const diameter = useDiameterAllowance()
  const desktop = useDesktop()

  const { material, applyMaterial, storageUnavailable: materialStorageUnavailable } = useMaterialSettings()
  const { mode: weightUnit, selectMode: selectWeightUnit } = useWeightUnit()
  const { mode: lengthUnit, selectMode: selectLengthUnit } = useLengthUnit()

  const [dragging, setDragging] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [materialOpen, setMaterialOpen] = useState(false)

  const hasFile = entries.length > 0
  const activeEntry = entries.length > 0 ? entries[entries.length - 1] : null

  const acceptFiles = (files: File[]) => {
    if (!files.length) return
    setRemoving(false)
    addFiles(desktop ? files : files.slice(0, 1))
  }

  const remove = (id: string) => {
    if (entries.length === 1) setRemoving(false)
    removeFile(id)
  }

  const clear = () => {
    setRemoving(false)
    clearFiles()
  }

  const choose = () => input.current?.click()

  return (
    <div
      className="app-shell"
      onDragOver={event => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={event => {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
          setDragging(false)
        }
      }}
      onDrop={event => {
        event.preventDefault()
        setDragging(false)
        acceptFiles(Array.from(event.dataTransfer.files))
      }}
    >
      <input
        ref={input}
        hidden
        type="file"
        accept=".anc"
        multiple={desktop}
        aria-label={text.upload}
        onChange={event => {
          const files = Array.from(event.currentTarget.files ?? [])
          event.currentTarget.value = ''
          acceptFiles(files)
        }}
      />

      <main className={`app-main ${hasFile ? 'with-result' : 'is-empty'} ${removing ? 'is-removing' : ''}`}>
        {restoring ? (
          <p className="session-restoring" role="status">
            <LoaderCircle className="spin" size={18} aria-hidden="true" />
            {text.restoringFiles}
          </p>
        ) : !hasFile ? (
          <section className="empty-state">
            <div className="upload-symbol">
              <FileUp size={27} strokeWidth={1.5} aria-hidden="true" />
            </div>
            <h1>{text.emptyTitle}</h1>
            <p>{desktop ? text.desktopEmptyDescription : text.emptyDescription}</p>
            <div className="empty-state-actions">
              <Button onClick={() => setLibraryOpen(true)}>
                <FolderArchive aria-hidden="true" size={16} />
                {text.browseLibrary}
              </Button>
              <Button variant="outline" onClick={choose}>
                <Plus aria-hidden="true" size={16} />
                {text.uploadFromDevice}
              </Button>
            </div>
          </section>
        ) : desktop ? (
          <BatchResults
            diameterAllowanceMm={diameter.allowanceMm}
            onDiameterAllowanceChange={diameter.applyAllowance}
            entries={entries}
            requirements={requirements}
            display={display}
            onDisplayChange={updateDisplay}
            sort={sort}
            onSortChange={updateSort}
            removing={removing}
            onRemove={remove}
            onRequirementChange={setFileRequirements}
          />
        ) : activeEntry ? (
          <MobileResultView
            entry={activeEntry}
            diameterAllowanceMm={diameter.allowanceMm}
            material={material}
            weightUnit={weightUnit}
            lengthUnit={lengthUnit}
            onWeightUnitChange={selectWeightUnit}
            onLengthUnitChange={selectLengthUnit}
            onMaterialOpen={() => setMaterialOpen(true)}
            onOpenLibrary={() => setLibraryOpen(true)}
          />
        ) : null}
      </main>

      {storageUnavailable && <p className="session-storage-error" role="alert">{text.sessionStorageUnavailable}</p>}
      {diameter.storageUnavailable && <p className="session-storage-error" role="alert">{text.storageUnavailable}</p>}
      {materialStorageUnavailable && <p className="session-storage-error" role="alert">{text.storageUnavailable}</p>}

      {hasFile && (
        <FileActions
          removing={removing}
          onAdd={choose}
          onOpenLibrary={() => setLibraryOpen(true)}
          onToggleRemoving={() => setRemoving(value => !value)}
          onClear={clear}
        />
      )}

      {/* Preset Library: Desktop Modal vs Mobile Bottom Drawer */}
      {libraryOpen && (
        desktop ? (
          <PresetLibraryDialog
            currentFileNames={new Set(entries.map(e => e.source.name))}
            onSelect={file => {
              acceptFiles([file])
              setLibraryOpen(false)
            }}
            onDismiss={() => setLibraryOpen(false)}
          />
        ) : (
          <MobilePresetDrawer
            currentFileNames={new Set(entries.map(e => e.source.name))}
            onSelect={file => {
              acceptFiles([file])
              setLibraryOpen(false)
            }}
            onDismiss={() => setLibraryOpen(false)}
          />
        )
      )}

      {/* Mobile Material Dialog */}
      {!desktop && materialOpen && (
        <MaterialDialog
          value={material}
          unit={weightUnit === 'oz' ? 'oz' : 'g'}
          onApply={applyMaterial}
          onDismiss={() => setMaterialOpen(false)}
        />
      )}

      <footer className="app-footer">
        <ShieldCheck size={13} aria-hidden="true" />
        <span>{text.privacy}</span>
      </footer>

      {dragging && (
        <div className="drop-overlay">
          <FileUp size={32} aria-hidden="true" />
          <span>{text.drop}</span>
        </div>
      )}
    </div>
  )
}
