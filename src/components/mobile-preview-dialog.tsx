import { lazy, Suspense } from 'react'
import { LoaderCircle, X } from 'lucide-react'
import type { AnalysisResult } from '../domain/types'
import { displayFileName } from '../lib/file-name'
import { text } from '../i18n/zh-TW'
import { PreviewBoundary } from './preview-boundary'
import { PreviewMeasurements } from './preview-measurements'
import { PreviewModeSwitch, usePreviewMode } from './preview-mode'
import type { BatProperties } from '../domain/bat-properties'
import type { MassPropertyUnits } from '../domain/mass-property-units'
import { defaultMassPropertyUnits } from '../config/mass-properties'
import { BatPropertiesSummary } from './bat-properties-summary'

const BatPreview = lazy(() => import('./bat-preview'))

export function MobilePreviewDialog({ result, onClose, properties, massUnits = defaultMassPropertyUnits }: {
  result: Extract<AnalysisResult, { status: 'calculated' }>; onClose: () => void; properties?: BatProperties; massUnits?: MassPropertyUnits
}) {
  const preview = usePreviewMode(true)
  return <div className="mobile-3d-overlay" role="dialog" aria-modal="true" aria-label={text.view3dModel}>
    <div className="mobile-3d-header">
      <span className="mobile-3d-title" title={displayFileName(result.source.name)}>{displayFileName(result.source.name)}</span>
      <PreviewModeSwitch {...preview} />
      <button type="button" className="mobile-3d-close" onClick={onClose} aria-label={text.close3dModel}><X size={20} /></button>
    </div>
    <div className="mobile-3d-body">
      <PreviewBoundary>
        <Suspense fallback={<div className="preview-fallback"><LoaderCircle className="spin" size={20} />{text.previewLoading}</div>}>
          <BatPreview result={result} mode={preview.mode} interactionHelp={text.orbitTouchHelp} />
        </Suspense>
      </PreviewBoundary>
      <PreviewMeasurements dimensions={result.dimensions} />
      {properties && <BatPropertiesSummary properties={properties} units={massUnits} className="preview-properties" />}
    </div>
  </div>
}
