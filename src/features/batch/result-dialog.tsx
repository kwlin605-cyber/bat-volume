import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { AnalysisEntry } from '../../services/analysis-state'
import { ResultView } from '../../components/result-view'
import { text } from '../../i18n/zh-TW'

export function ResultDialog({ entry, onDismiss }: { entry: AnalysisEntry; onDismiss: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (dialog.current && !dialog.current.open) dialog.current.showModal() }, [])
  return <dialog ref={dialog} className="result-dialog" aria-labelledby="preview-dialog-title" onClose={onDismiss} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }}>
    <div className="dialog-heading"><h2 id="preview-dialog-title">{entry.source.name}</h2><button type="button" className="icon-button" aria-label={text.closePreview} onClick={() => dialog.current?.close()}><X size={20} /></button></div>
    <ResultView state={entry.state} preview />
  </dialog>
}
