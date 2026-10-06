import { lazy, Suspense, useRef, useState } from 'react'
import { FileUp, LoaderCircle, Plus, ShieldCheck } from 'lucide-react'
import { Button } from './components/ui/button'
import { ResultCard } from './components/result-card'
import { PreviewBoundary } from './components/preview-boundary'
import { useAnalysis } from './hooks/use-analysis'
import { useDesktop } from './hooks/use-desktop'
import { text } from './i18n/zh-TW'

const BatPreview = lazy(() => import('./components/bat-preview'))

export default function App() {
  const input = useRef<HTMLInputElement>(null)
  const { state, loadFile } = useAnalysis()
  const desktop = useDesktop()
  const [dragging, setDragging] = useState(false)
  const hasFile = state.status !== 'empty'
  const result = state.status === 'result' ? state.result : null
  const choose = () => input.current?.click()
  return <div className="app-shell" onDragOver={event => { event.preventDefault(); setDragging(true) }} onDragLeave={event => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragging(false) }} onDrop={event => {
    event.preventDefault(); setDragging(false)
    const file = event.dataTransfer.files[0]
    if (file) void loadFile(file)
  }}>
    <header className="app-header">
      <a className="brand" href="./" aria-label={text.logoAlt}><span className="brand-mark"><FileUp size={18} strokeWidth={1.8} aria-hidden="true" /></span><span>{text.appName}</span></a>
      {hasFile && <Button variant="outline" size="sm" onClick={choose}><Plus aria-hidden="true" />{text.replace}</Button>}
    </header>
    <input ref={input} hidden type="file" accept=".anc" aria-label={text.upload} onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void loadFile(file) }} />
    <main className={`app-main ${hasFile ? 'with-result' : 'is-empty'}`}>
      {!hasFile ? <section className="empty-state">
        <div className="upload-symbol"><FileUp size={27} strokeWidth={1.5} aria-hidden="true" /></div>
        <h1>{text.emptyTitle}</h1>
        <p>{text.emptyDescription}</p>
        <Button onClick={choose}><Plus aria-hidden="true" />{text.upload}</Button>
      </section> : <div className={`result-layout ${result?.profile && desktop ? 'with-preview' : ''}`}>
        <ResultCard state={state} />
        {desktop && result?.profile && <PreviewBoundary key={result.source.name}><Suspense fallback={<div className="preview-fallback"><LoaderCircle className="spin" size={18} />{text.previewLoading}</div>}><BatPreview key={result.source.name} result={result} /></Suspense></PreviewBoundary>}
      </div>}
    </main>
    <footer className="app-footer"><ShieldCheck size={13} aria-hidden="true" /><span>{text.privacy}</span></footer>
    {dragging && <div className="drop-overlay"><FileUp size={32} aria-hidden="true" /><span>{text.drop}</span></div>}
  </div>
}
