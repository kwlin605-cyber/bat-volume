import { useRef, useState } from 'react'
import { FileUp, Plus, ShieldCheck } from 'lucide-react'
import { Button } from './components/ui/button'
import { ResultView } from './components/result-view'
import BatchResults from './features/batch/batch-results'
import { useAnalysis } from './hooks/use-analysis'
import { useDesktop } from './hooks/use-desktop'
import { text } from './i18n/zh-TW'

export default function App() {
  const input = useRef<HTMLInputElement>(null)
  const { entries, loadFiles } = useAnalysis()
  const desktop = useDesktop()
  const [dragging, setDragging] = useState(false)
  const hasFile = entries.length > 0
  const acceptFiles = (files: File[]) => loadFiles(desktop ? files : files.slice(0, 1))
  const choose = () => input.current?.click()
  return <div className="app-shell" onDragOver={event => { event.preventDefault(); setDragging(true) }} onDragLeave={event => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragging(false) }} onDrop={event => {
    event.preventDefault(); setDragging(false)
    acceptFiles(Array.from(event.dataTransfer.files))
  }}>
    <header className="app-header">
      <a className="brand" href="./" aria-label={text.logoAlt}><span className="brand-mark"><FileUp size={18} strokeWidth={1.8} aria-hidden="true" /></span><span>{text.appName}</span></a>
      {hasFile && <Button size="sm" className="replace-files-button" onClick={choose}><Plus aria-hidden="true" />{text.replace}</Button>}
    </header>
    <input ref={input} hidden type="file" accept=".anc" multiple={desktop} aria-label={text.upload} onChange={event => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ''; acceptFiles(files) }} />
    <main className={`app-main ${hasFile ? 'with-result' : 'is-empty'}`}>
      {!hasFile ? <section className="empty-state">
        <div className="upload-symbol"><FileUp size={27} strokeWidth={1.5} aria-hidden="true" /></div>
        <h1>{text.emptyTitle}</h1>
        <p>{desktop ? text.desktopEmptyDescription : text.emptyDescription}</p>
        <Button onClick={choose}><Plus aria-hidden="true" />{text.upload}</Button>
      </section> : desktop ? <BatchResults entries={entries} /> : <ResultView key={entries[0].id} state={entries[0].state} preview={false} />}
    </main>
    <footer className="app-footer"><ShieldCheck size={13} aria-hidden="true" /><span>{text.privacy}</span></footer>
    {dragging && <div className="drop-overlay"><FileUp size={32} aria-hidden="true" /><span>{text.drop}</span></div>}
  </div>
}
