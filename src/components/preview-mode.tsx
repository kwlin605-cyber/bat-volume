import { useState } from 'react'
import { text } from '../i18n/zh-TW'

export type PreviewMode = 'trimmed' | 'whole'

export function usePreviewMode(canTrim: boolean) {
  const [selected, onChange] = useState<PreviewMode>('trimmed')
  const mode: PreviewMode = canTrim ? selected : 'whole'
  return { mode, canTrim, onChange }
}

export function PreviewModeSwitch({ mode, canTrim, onChange }: {
  mode: PreviewMode; canTrim: boolean; onChange: (mode: PreviewMode) => void
}) {
  return <div className="view-toggle" role="group" aria-label={text.previewTitle}>
    <button type="button" aria-pressed={mode === 'trimmed'} disabled={!canTrim} onClick={() => onChange('trimmed')}>{text.trimmed}</button>
    <button type="button" aria-pressed={mode === 'whole'} onClick={() => onChange('whole')}>{text.whole}</button>
  </div>
}
