import { lazy, Suspense, useState } from 'react'
import { Box, CircleAlert, FileCode2, LoaderCircle, RefreshCw, Settings2, X } from 'lucide-react'
import type { AnalysisEntry } from '../services/analysis-state'
import type { MaterialSettings } from '../domain/weight'
import { estimateBatWeight, calculateMaterialWeight } from '../domain/weight'
import type { WeightDisplayMode } from '../domain/weight-unit'
import type { LengthDisplayMode } from '../domain/length-unit'
import { weightDisplay } from '../lib/weight-display'
import { lengthDisplay } from '../lib/length-display'
import { formatCoordinate, formatDimension, formatVolume } from '../lib/format'
import { defaultDiameterAllowanceMm, finishedDiameter } from '../domain/diameter-allowance'
import { displayFileName } from '../lib/file-name'
import { diagnosticText, gripDiagnosticText, text } from '../i18n/zh-TW'
import { PreviewBoundary } from './preview-boundary'

const BatPreview = lazy(() => import('./bat-preview'))

interface Props {
  entry: AnalysisEntry
  diameterAllowanceMm?: number
  material: MaterialSettings
  weightUnit: WeightDisplayMode
  lengthUnit: LengthDisplayMode
  onWeightUnitChange: (unit: WeightDisplayMode) => void
  onLengthUnitChange: (unit: LengthDisplayMode) => void
  onMaterialOpen: () => void
  onOpenLibrary: () => void
}

export function MobileResultView({
  entry,
  diameterAllowanceMm = defaultDiameterAllowanceMm,
  material,
  weightUnit,
  lengthUnit,
  onWeightUnitChange,
  onLengthUnitChange,
  onMaterialOpen,
  onOpenLibrary,
}: Props) {
  const [show3d, setShow3d] = useState(false)
  const state = entry.state
  const source = state.status === 'loading' ? state.source : state.result.source
  const result = state.status === 'result' ? state.result : null
  const calculated = result?.status === 'calculated'

  // Has material been configured?
  const hasMaterial = material.referenceDensity !== null || (material.volumeCm3 !== null && material.weightG !== null)

  const estimatedBatWeight = calculated && result
    ? estimateBatWeight(material, result.volumeCm3)
    : null

  const materialCalc = calculated && result
    ? calculateMaterialWeight(material, result.volumeCm3, null)
    : null

  const batWeightFormatted = estimatedBatWeight !== null
    ? weightDisplay(estimatedBatWeight, undefined, weightUnit)
    : null

  const matWeightFormatted = materialCalc && materialCalc.kind === 'reference'
    ? weightDisplay(materialCalc.weightG, undefined, weightUnit)
    : materialCalc && materialCalc.kind === 'recommended'
      ? weightDisplay(materialCalc.range.min, materialCalc.range.max, weightUnit)
      : null

  const dimensions = calculated && result ? result.dimensions : null
  const grip = dimensions?.grip
  const lengthFormatted = dimensions ? lengthDisplay(dimensions.lengthMm, lengthUnit) : null

  const maxDia = dimensions ? finishedDiameter(dimensions.maximumDiameterMm, diameterAllowanceMm) : null
  const gripRaw = grip && grip.status === 'detected' ? grip.diameterMm : null
  const gripDia = finishedDiameter(gripRaw, diameterAllowanceMm)

  function toggleWeightUnit() {
    onWeightUnitChange(weightUnit === 'g' ? 'oz' : 'g')
  }

  function toggleLengthUnit() {
    onLengthUnitChange(lengthUnit === 'cm' ? 'in' : 'cm')
  }

  return (
    <div className="mobile-view-container">
      {/* Top Sticky Bar */}
      <header className="mobile-header-bar">
        <div className="mobile-header-file">
          <FileCode2 size={16} className="mobile-header-icon" aria-hidden="true" />
          <span className="mobile-header-name" title={displayFileName(source.name)}>
            {displayFileName(source.name)}
          </span>
        </div>
        <div className="mobile-header-actions">
          <button
            type="button"
            className="mobile-header-btn"
            onClick={onOpenLibrary}
            aria-label={text.changeBat}
            title={text.changeBat}
          >
            <RefreshCw size={14} aria-hidden="true" />
            <span>{text.changeBat}</span>
          </button>
          {calculated && result?.profile && (
            <button
              type="button"
              className="mobile-header-btn"
              onClick={() => setShow3d(true)}
              aria-label={text.view3dModel}
              title={text.view3dModel}
            >
              <Box size={14} aria-hidden="true" />
              <span>{text.view3dModel}</span>
            </button>
          )}
          <button
            type="button"
            className="mobile-header-btn"
            onClick={onMaterialOpen}
            aria-label={text.materialSettings}
            title={text.materialSettings}
          >
            <Settings2 size={14} aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="mobile-view-content">
        {state.status === 'loading' ? (
          <div className="mobile-card mobile-loading-card">
            <LoaderCircle className="spin text-zinc-500" size={26} aria-hidden="true" />
            <p className="mobile-loading-text">{text.loadingDescription}</p>
          </div>
        ) : calculated && result && dimensions ? (
          <>
            {/* Hero Card: Prominent Weights */}
            <section className="mobile-card mobile-weight-hero">
              <div className="mobile-card-tag-row">
                <span className="mobile-card-tag">{text.batWeight}</span>
                {hasMaterial && (
                  <button
                    type="button"
                    className="mobile-unit-toggle"
                    onClick={toggleWeightUnit}
                    title={text.clickToSwitchUnit}
                  >
                    {weightUnit === 'g' ? '公克 (g)' : '盎司 (oz)'}
                  </button>
                )}
              </div>

              {hasMaterial && batWeightFormatted ? (
                <div className="mobile-weights-grid">
                  {/* Estimated Bat Weight */}
                  <div className="mobile-weight-block">
                    <span className="mobile-weight-label">{text.estimatedBatWeight}</span>
                    <div className="mobile-weight-val-wrap">
                      <span className="mobile-weight-val">{batWeightFormatted.display}</span>
                      {batWeightFormatted.secondary && (
                        <small className="mobile-weight-sub">{batWeightFormatted.secondary}</small>
                      )}
                    </div>
                  </div>

                  {/* Required Material Weight */}
                  {matWeightFormatted && (
                    <div className="mobile-weight-block">
                      <span className="mobile-weight-label">{text.requiredMaterialWeight}</span>
                      <div className="mobile-weight-val-wrap">
                        <span className="mobile-weight-val">{matWeightFormatted.display}</span>
                        {matWeightFormatted.secondary && (
                          <small className="mobile-weight-sub">{matWeightFormatted.secondary}</small>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Unconfigured Guide Button */
                <button
                  type="button"
                  className="mobile-unconfigured-guide"
                  onClick={onMaterialOpen}
                >
                  <div className="mobile-guide-icon">
                    <Settings2 size={20} aria-hidden="true" />
                  </div>
                  <div className="mobile-guide-text">
                    <span className="mobile-guide-title">{text.unconfiguredMaterial}</span>
                    <span className="mobile-guide-desc">{text.configureMaterialHint}</span>
                  </div>
                </button>
              )}
            </section>

            {/* Geometry Dimensions Card */}
            <section className="mobile-card mobile-dimensions-card">
              <div className="mobile-card-tag-row">
                <span className="mobile-card-tag">{text.dimensions}</span>
                {lengthFormatted && (
                  <button
                    type="button"
                    className="mobile-unit-toggle"
                    onClick={toggleLengthUnit}
                    title={text.clickToSwitchUnit}
                  >
                    {lengthUnit === 'cm' ? '公分 (cm)' : '英吋 (in)'}
                  </button>
                )}
              </div>

              <dl className="mobile-dims-list">
                {/* Length */}
                <div className="mobile-dim-row">
                  <dt>{text.retainedLength}</dt>
                  <dd>
                    <span>{lengthFormatted?.display ?? '-'}</span>
                    {lengthFormatted?.secondary && <small className="text-zinc-500 font-normal text-xs">{lengthFormatted.secondary}</small>}
                  </dd>
                </div>

                {/* Maximum Diameter */}
                <div className="mobile-dim-row">
                  <dt>{text.maximumDiameter}</dt>
                  <dd>
                    {maxDia !== null ? (
                      <>
                        <span>{formatDimension(maxDia)}</span>
                        <span className="mobile-dim-unit">{text.millimetreUnit}</span>
                      </>
                    ) : (
                      <span className="text-zinc-400">{text.missingValue}</span>
                    )}
                  </dd>
                </div>

                {/* Grip Diameter */}
                <div className="mobile-dim-row">
                  <dt>{text.minimumGripDiameter}</dt>
                  <dd>
                    {gripDia !== null ? (
                      <>
                        <span>{formatDimension(gripDia)}</span>
                        <span className="mobile-dim-unit">{text.millimetreUnit}</span>
                      </>
                    ) : (
                      <span className="text-zinc-400">
                        {grip && grip.status === 'undetermined' ? gripDiagnosticText[grip.code] : text.missingValue}
                      </span>
                    )}
                  </dd>
                </div>

                {/* Retained Volume */}
                <div className="mobile-dim-row">
                  <dt>{text.retainedVolume}</dt>
                  <dd>
                    <span>{formatVolume(result.volumeCm3)}</span>
                    <span className="mobile-dim-unit">{text.volumeUnit}</span>
                  </dd>
                </div>
              </dl>

              {/* Collapsible Cuts */}
              <details className="mobile-cut-details">
                <summary>{text.cuts}</summary>
                <div className="mobile-cut-values">
                  <div className="mobile-cut-item">
                    <span>{text.cutLow}</span>
                    <strong>{formatCoordinate(result.cuts.low)} {text.millimetreUnit}</strong>
                  </div>
                  <div className="mobile-cut-item">
                    <span>{text.cutHigh}</span>
                    <strong>{formatCoordinate(result.cuts.high)} {text.millimetreUnit}</strong>
                  </div>
                </div>
              </details>
            </section>
          </>
        ) : result?.status === 'undetermined' ? (
          <div className="mobile-card mobile-error-card">
            <CircleAlert size={28} className="text-zinc-500" aria-hidden="true" />
            <h2>{diagnosticText[result.code]}</h2>
            <p>{text.failureDescription}</p>
          </div>
        ) : null}
      </main>

      {/* 3D Fullscreen Modal */}
      {show3d && calculated && result?.profile && (
        <div className="mobile-3d-overlay" role="dialog" aria-modal="true" aria-label={text.view3dModel}>
          <div className="mobile-3d-header">
            <span className="mobile-3d-title">{displayFileName(source.name)}</span>
            <button
              type="button"
              className="mobile-3d-close"
              onClick={() => setShow3d(false)}
              aria-label={text.close3dModel}
            >
              <X size={20} />
            </button>
          </div>
          <div className="mobile-3d-body">
            <PreviewBoundary>
              <Suspense
                fallback={
                  <div className="preview-fallback">
                    <LoaderCircle className="spin" size={20} />
                    {text.previewLoading}
                  </div>
                }
              >
                <BatPreview result={result} />
              </Suspense>
            </PreviewBoundary>
          </div>
        </div>
      )}
    </div>
  )
}
