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
import { batPropertyDisplay } from '../lib/mass-property-display'

const BatPreview = lazy(() => import('./bat-preview'))

export function MobilePreviewDialog({ result, onClose, properties, massUnits = defaultMassPropertyUnits }: {
  result: Extract<AnalysisResult, { status: 'calculated' }>; onClose: () => void; properties?: BatProperties; massUnits?: MassPropertyUnits
}) {
  const preview = usePreviewMode(true)
  const propertyRows = properties ? batPropertyDisplay(properties, massUnits) : []
  const orderedProperties = [...propertyRows.filter(row => row.id !== 'weight'), ...propertyRows.filter(row => row.id === 'weight')]
  return <div className="mobile-3d-overlay" role="dialog" aria-modal="true" aria-label={text.view3dModel}>
    <div className="mobile-3d-header">
      <span className="mobile-3d-title" title={displayFileName(result.source.name)}>{displayFileName(result.source.name)}</span>
      <PreviewModeSwitch {...preview} />
      <button type="button" className="mobile-3d-close" onClick={onClose} aria-label={text.close3dModel}><X size={20} /></button>
    </div>
    <div className="mobile-3d-body">
      <div className="mobile-3d-viewport">
        <PreviewBoundary>
          <Suspense fallback={<div className="preview-fallback"><LoaderCircle className="spin" size={20} />{text.previewLoading}</div>}>
            <BatPreview result={result} mode={preview.mode} interactionHelp={text.orbitTouchHelp} />
          </Suspense>
        </PreviewBoundary>
      </div>
      <div className="mobile-3d-info">
        <PreviewMeasurements dimensions={result.dimensions} />
        {properties && <dl className="preview-properties" aria-label={text.massPropertiesDescription} title={text.massPropertiesDescription}>
          {orderedProperties.map(row => <div key={row.id} className={`preview-property-${row.id}`}>
            <dt>{row.label}</dt>
            <dd data-testid={`property-${row.id}`}><span>{row.display}</span>{row.unit && <small>{row.unit}</small>}</dd>
          </div>)}
        </dl>}
      </div>
    </div>
  </div>
}
