import { X } from 'lucide-react'
import { text } from '../i18n/zh-TW'

export function RemoveFileButton({ name, onRemove }: { name: string; onRemove: () => void }) {
  return <button type="button" className="remove-file-button" aria-label={`${text.removeFile} ${name}`} title={`${text.removeFile} ${name}`} onClick={onRemove}><X size={16} aria-hidden="true" /></button>
}
