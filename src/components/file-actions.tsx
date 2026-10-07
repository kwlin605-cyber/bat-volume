import { Check, Plus, Trash2 } from 'lucide-react'
import { text } from '../i18n/zh-TW'

export function FileActions({ removing, onAdd, onToggleRemoving, onClear }: { removing: boolean; onAdd: () => void; onToggleRemoving: () => void; onClear: () => void }) {
  return <div className={`file-actions ${removing ? 'is-removing' : ''}`}>
    <button type="button" className="remove-mode-button" aria-label={removing ? text.finishRemoving : text.removeFiles} title={removing ? text.finishRemoving : text.removeFiles} aria-pressed={removing} onClick={onToggleRemoving}>
      {removing ? <Check size={20} aria-hidden="true" /> : <Trash2 size={19} aria-hidden="true" />}
    </button>
    <div className="remove-all-slot" aria-hidden={!removing}><button type="button" className="file-action-button" tabIndex={removing ? 0 : -1} onClick={onClear}><Trash2 size={18} aria-hidden="true" />{text.removeAllFiles}</button></div>
    <button type="button" className="file-action-button" onClick={onAdd}><Plus size={18} aria-hidden="true" />{text.addFiles}</button>
  </div>
}
