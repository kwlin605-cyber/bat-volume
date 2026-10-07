import { useRef, useState } from 'react'
import { FileUp, Plus, ShieldCheck, LoaderCircle } from 'lucide-react'
import { Button } from './components/ui/button'
import { ResultView } from './components/result-view'
import BatchResults from './features/batch/batch-results'
import { useBatchSession } from './hooks/use-batch-session'
import { FileActions } from './components/file-actions'
import { RemoveFileButton } from './components/remove-file-button'
import { useDesktop } from './hooks/use-desktop'
import { text } from './i18n/zh-TW'

export default function App() {
  const input = useRef<HTMLInputElement>(null)
  const { entries, requirements, display, restoring, storageUnavailable, addFiles, removeFile, clearFiles, setRequirement, updateDisplay } = useBatchSession()
  const desktop = useDesktop()
  const [dragging, setDragging] = useState(false)
  const [removing, setRemoving] = useState(false)
  const hasFile = entries.length > 0
  const acceptFiles = (files: File[]) => {
    if (!files.length) return
    setRemoving(false)
    addFiles(desktop ? files : files.slice(0, 1))
  }
  const remove = (id: string) => { if (entries.length === 1) setRemoving(false); removeFile(id) }
  const clear = () => { setRemoving(false); clearFiles() }
  const choose = () => input.current?.click()
  return <div className="app-shell" onDragOver={event => { event.preventDefault(); setDragging(true) }} onDragLeave={event => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragging(false) }} onDrop={event => {
    event.preventDefault(); setDragging(false)
    acceptFiles(Array.from(event.dataTransfer.files))
  }}>
    <input ref={input} hidden type="file" accept=".anc" multiple={desktop} aria-label={text.upload} onChange={event => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ''; acceptFiles(files) }} />
    <main className={`app-main ${hasFile ? 'with-result' : 'is-empty'} ${removing ? 'is-removing' : ''}`}>
      {restoring ? <p className="session-restoring" role="status"><LoaderCircle className="spin" size={18} aria-hidden="true" />{text.restoringFiles}</p> : !hasFile ? <section className="empty-state">
        <div className="upload-symbol"><FileUp size={27} strokeWidth={1.5} aria-hidden="true" /></div>
        <h1>{text.emptyTitle}</h1>
        <p>{desktop ? text.desktopEmptyDescription : text.emptyDescription}</p>
        <Button onClick={choose}><Plus aria-hidden="true" />{text.upload}</Button>
      </section> : desktop ? <BatchResults entries={entries} requirements={requirements} display={display} onDisplayChange={updateDisplay} removing={removing} onRemove={remove} onRequirementChange={setRequirement} /> : <div className="mobile-results">{entries.map(entry => <div key={entry.id} className="mobile-result-item">
        {removing && <RemoveFileButton name={entry.source.name} onRemove={() => remove(entry.id)} />}
        <ResultView state={entry.state} preview={false} />
      </div>)}</div>}
    </main>
    {storageUnavailable && <p className="session-storage-error" role="alert">{text.sessionStorageUnavailable}</p>}
    {hasFile && <FileActions removing={removing} onAdd={choose} onToggleRemoving={() => setRemoving(value => !value)} onClear={clear} />}
    <footer className="app-footer"><ShieldCheck size={13} aria-hidden="true" /><span>{text.privacy}</span></footer>
    {dragging && <div className="drop-overlay"><FileUp size={32} aria-hidden="true" /><span>{text.drop}</span></div>}
  </div>
}
