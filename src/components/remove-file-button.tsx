import { displayFileLabel } from '../lib/file-name'
import { X } from 'lucide-react'
import { text } from '../i18n/zh-TW'

export function RemoveFileButton({ name, sourceLabel, onRemove }: { name: string; sourceLabel?: string; onRemove: () => void }) {
  return <button type="button" className="remove-file-button" aria-label={`${text.removeFile} ${displayFileLabel(name, sourceLabel)}`} title={`${text.removeFile} ${name}${sourceLabel ? ` ${sourceLabel}` : ''}`} onClick={onRemove}><X size={16} aria-hidden="true" /></button>
}
