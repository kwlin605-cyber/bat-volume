import { displayFileName } from '../../lib/file-name'
import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { AnalysisEntry } from '../../services/analysis-state'
import { ResultView } from '../../components/result-view'
import { text } from '../../i18n/zh-TW'
import { PreviewModeSwitch, usePreviewMode } from '../../components/preview-mode'
import type { MaterialSettings, WeightRange } from '../../domain/weight'
import type { MassPropertyUnits } from '../../domain/mass-property-units'
import { defaultMassPropertyUnits } from '../../config/mass-properties'
import { initialMaterialSettings } from '../../config/weight'
import { calculateBatProperties } from '../../domain/bat-properties'

export function ResultDialog({ entry, onDismiss, diameterAllowanceMm, material = initialMaterialSettings, requirement = null, massUnits = defaultMassPropertyUnits }: {
  diameterAllowanceMm: number; entry: AnalysisEntry; onDismiss: () => void; material?: MaterialSettings; requirement?: WeightRange | null; massUnits?: MassPropertyUnits
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const result = entry.state.status === 'result' ? entry.state.result : null
  const hasPreview = Boolean(result?.profile)
  const preview = usePreviewMode(result?.status === 'calculated')
  useEffect(() => { if (dialog.current && !dialog.current.open) dialog.current.showModal() }, [])
  return <dialog ref={dialog} className="result-dialog" aria-labelledby="preview-dialog-title" onClose={onDismiss} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }}>
    <div className={`dialog-heading ${hasPreview ? 'result-preview-heading' : ''}`}>
      <h2 id="preview-dialog-title" title={displayFileName(entry.source.name)}>{displayFileName(entry.source.name)}</h2>
      <div className="preview-heading-actions">
        {hasPreview && <PreviewModeSwitch {...preview} />}
        <button type="button" className="icon-button" aria-label={text.closePreview} onClick={() => dialog.current?.close()}><X size={20} /></button>
      </div>
    </div>
    <ResultView properties={calculateBatProperties(result, material, requirement)} massUnits={massUnits} diameterAllowanceMm={diameterAllowanceMm} state={entry.state} preview previewMode={preview.mode} />
  </dialog>
}
