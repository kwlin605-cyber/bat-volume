import { lazy, Suspense, useRef, useState } from 'react'
import { Box, ChevronDown, CircleAlert, FileCode2, LoaderCircle, Plus, Settings2, X } from 'lucide-react'
import type { AnalysisEntry } from '../services/analysis-state'
import type { MaterialSettings, WeightRange } from '../domain/weight'
import { estimateBatWeight, calculateMaterialWeight } from '../domain/weight'
import type { WeightDisplayMode } from '../domain/weight-unit'
import type { LengthDisplayMode } from '../domain/length-unit'
import { weightDisplay, weightHeaderUnit, weightUnitLabel } from '../lib/weight-display'
import { lengthDisplay } from '../lib/length-display'
import { formatCoordinate, formatDimension, formatVolume } from '../lib/format'
import { defaultDiameterAllowanceMm, finishedDiameter } from '../domain/diameter-allowance'
import { displayFileName } from '../lib/file-name'
import { diagnosticText, gripDiagnosticText, text } from '../i18n/zh-TW'
import { parseRequirement } from '../features/batch/weight-input'
import { PreviewBoundary } from './preview-boundary'

const BatPreview = lazy(() => import('./bat-preview'))

interface Props {
  entry: AnalysisEntry
  diameterAllowanceMm?: number
  material: MaterialSettings
  weightUnit: WeightDisplayMode
  lengthUnit: LengthDisplayMode
  requirement?: WeightRange | null
  onWeightUnitChange?: (unit: WeightDisplayMode) => void
  onLengthUnitChange?: (unit: LengthDisplayMode) => void
  onRequirementChange?: (range: WeightRange | null) => void
  onMaterialOpen: () => void
  onOpenLibrary: () => void
  onClose?: () => void
}

export function MobileResultView({
  entry,
  diameterAllowanceMm = defaultDiameterAllowanceMm,
  material,
  weightUnit,
  lengthUnit,
  requirement = null,
  onRequirementChange,
  onMaterialOpen,
  onOpenLibrary,
  onClose,
}: Props) {
  const [show3d, setShow3d] = useState(false)
  const [specifying, setSpecifying] = useState(false)
  const [weightInputMin, setWeightInputMin] = useState('')
  const [weightInputMax, setWeightInputMax] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const minInputRef = useRef<HTMLInputElement>(null)
  const maxInputRef = useRef<HTMLInputElement>(null)
  const isCancellingRef = useRef(false)

  const state = entry.state
  const source = state.status === 'loading' ? state.source : state.result.source
  const result = state.status === 'result' ? state.result : null
  const calculated = result?.status === 'calculated'

  // Has material been configured?
  const hasMaterial = material.referenceDensity !== null || (material.volumeCm3 !== null && material.weightG !== null)

  // When a requirement is set, we calculate material weight based on requirement
  const materialCalc = calculated && result
    ? calculateMaterialWeight(material, result.volumeCm3, requirement)
    : null

  const estimatedBatWeight = calculated && result
    ? estimateBatWeight(material, result.volumeCm3)
    : null

  // Bat weight display: Either specified requirement, or density-estimated (always canonical grams)
  const batWeightFormatted = requirement
    ? weightDisplay(requirement.min, requirement.max === requirement.min ? undefined : requirement.max, 'g')
    : estimatedBatWeight !== null
      ? weightDisplay(estimatedBatWeight, undefined, 'g')
      : null

  // Required material weight display
  const matWeightFormatted = materialCalc && materialCalc.kind === 'recommended'
    ? weightDisplay(materialCalc.range.min, materialCalc.range.max, weightUnit)
    : materialCalc && materialCalc.kind === 'reference'
      ? weightDisplay(materialCalc.weightG, undefined, weightUnit)
      : null

  const dimensions = calculated && result ? result.dimensions : null
  const grip = dimensions?.grip
  const lengthFormatted = dimensions ? lengthDisplay(dimensions.lengthMm, lengthUnit) : null

  const maxDia = dimensions ? finishedDiameter(dimensions.maximumDiameterMm, diameterAllowanceMm) : null
  const gripRaw = grip && grip.status === 'detected' ? grip.diameterMm : null
  const gripDia = finishedDiameter(gripRaw, diameterAllowanceMm)

  function handleApplySpecifiedWeight() {
    setInputError(null)
    const minRaw = weightInputMin.trim()
    const maxRaw = weightInputMax.trim() || minRaw

    if (!minRaw && !maxRaw) {
      handleCancelSpecifying()
      return
    }

    const parsed = parseRequirement(minRaw, maxRaw, 'g', requirement)
    if (parsed.error || !parsed.range) {
      setInputError(parsed.error === 'range' ? text.invalidWeightRange : text.invalidPositiveNumber)
      return
    }

    onRequirementChange?.(parsed.range)
    setSpecifying(false)
    setWeightInputMin('')
    setWeightInputMax('')
  }

  function handleBoxBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (isCancellingRef.current) {
      isCancellingRef.current = false
      return
    }
    // If focus is still within the specify box (e.g. switching between min and max inputs), do nothing
    if (e.currentTarget.contains(e.relatedTarget as Node)) {
      return
    }
    const minRaw = weightInputMin.trim()
    const maxRaw = weightInputMax.trim()
    if (!minRaw && !maxRaw) {
      handleCancelSpecifying()
      return
    }
    handleApplySpecifiedWeight()
  }

  function handleMinKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      const raw = weightInputMin.trim()
      const val = parseFloat(raw)
      if (isNaN(val) || val <= 0) {
        setInputError(text.invalidPositiveNumber)
        return
      }
      setInputError(null)
      if (!weightInputMax.trim()) {
        setWeightInputMax(raw)
      }
      requestAnimationFrame(() => {
        maxInputRef.current?.focus()
        maxInputRef.current?.select()
      })
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancelSpecifying()
    }
  }

  function handleMaxKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleApplySpecifiedWeight()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancelSpecifying()
    }
  }

  function handleCancelSpecifying() {
    setSpecifying(false)
    setInputError(null)
    setWeightInputMin('')
    setWeightInputMax('')
    isCancellingRef.current = false
  }

  function handleClearRequirement() {
    onRequirementChange?.(null)
  }

  return (
    <div className="mobile-view-container">
      {/* Top Header Bar: Entire dark row is clickable to switch model */}
      <header className="mobile-header-bar">
        <button
          type="button"
          className="mobile-header-file-btn"
          onClick={onOpenLibrary}
          aria-label={`${text.switchBat}: ${displayFileName(source.name)}`}
          title={`${text.switchBat}: ${displayFileName(source.name)}`}
        >
          <FileCode2 size={16} className="mobile-header-icon" aria-hidden="true" />
          <span className="mobile-header-name" title={displayFileName(source.name)}>
            {displayFileName(source.name)}
          </span>
          <ChevronDown size={14} className="mobile-header-chevron" aria-hidden="true" />
        </button>
        <div className="mobile-header-actions">
          <button
            type="button"
            className="mobile-header-btn"
            onClick={onMaterialOpen}
            aria-label={text.materialSettings}
            title={text.materialSettings}
          >
            <Settings2 size={15} aria-hidden="true" />
          </button>
          {onClose && (
            <button
              type="button"
              className="mobile-header-btn"
              onClick={onClose}
              aria-label={text.closeBat}
              title={text.closeBat}
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
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
                <span className="mobile-card-tag">
                  {requirement ? text.specifiedTargetWeight : text.batWeight}
                </span>
                {requirement && (
                  <button
                    type="button"
                    className="mobile-cancel-requirement-btn"
                    onClick={handleClearRequirement}
                    title={text.clearSpecifiedWeight}
                    aria-label={text.clearSpecifiedWeight}
                  >
                    <X size={13} aria-hidden="true" />
                    <span>{text.clearSpecifiedWeight}</span>
                  </button>
                )}
              </div>

              {/* Weight Grid */}
              <div className="mobile-weights-grid">
                {/* Left: Bat Weight (Target or Estimated) */}
                <div className="mobile-weight-block">
                  <span className="mobile-weight-label">
                    {requirement ? text.batWeight : text.estimatedBatWeight}
                  </span>
                  <div className="mobile-weight-val-wrap">
                    {batWeightFormatted ? (
                      <>
                        <span className="mobile-weight-val">{batWeightFormatted.display}</span>
                        <small className="mobile-weight-sub">{text.weightUnit}</small>
                      </>
                    ) : (
                      <span className="mobile-weight-val text-zinc-400">—</span>
                    )}
                  </div>
                </div>

                {/* Right: Required Material Weight */}
                <div className="mobile-weight-block">
                  <span className="mobile-weight-label">{text.requiredMaterialWeight}</span>
                  <div className="mobile-weight-val-wrap">
                    {matWeightFormatted ? (
                      <>
                        <span className="mobile-weight-val font-semibold">{matWeightFormatted.display}</span>
                        <small className="mobile-weight-sub">
                          {weightUnit === 'both' ? text.ounceUnit : weightUnitLabel(weightUnit)}
                        </small>
                      </>
                    ) : materialCalc?.kind === 'unavailable' && materialCalc.reason === 'materialTooSmall' ? (
                      <span className="mobile-weight-val text-amber-600 text-sm">{text.materialTooSmall}</span>
                    ) : (
                      <span className="mobile-weight-val text-zinc-400">—</span>
                    )}
                    {matWeightFormatted?.secondary && (
                      <small className="mobile-weight-sub">/ {matWeightFormatted.secondary} {text.weightUnit}</small>
                    )}
                  </div>
                </div>
              </div>

              {/* Specify Weight Inline Box / Trigger */}
              {!requirement && (
                <div className="mobile-specify-wrap">
                  {specifying ? (
                    <div className="mobile-specify-box" onBlur={handleBoxBlur}>
                      <div className="mobile-specify-inputs">
                        <input
                          ref={minInputRef}
                          type="number"
                          inputMode="decimal"
                          step="any"
                          placeholder={text.minimumWeight}
                          value={weightInputMin}
                          onChange={e => {
                            setWeightInputMin(e.target.value)
                            setInputError(null)
                          }}
                          onKeyDown={handleMinKeyDown}
                          className="mobile-specify-input"
                          autoFocus
                        />
                        <span className="text-zinc-400 font-light">~</span>
                        <input
                          ref={maxInputRef}
                          type="number"
                          inputMode="decimal"
                          step="any"
                          placeholder={text.maximumWeight}
                          value={weightInputMax}
                          onChange={e => {
                            setWeightInputMax(e.target.value)
                            setInputError(null)
                          }}
                          onKeyDown={handleMaxKeyDown}
                          className="mobile-specify-input"
                        />
                        <span className="mobile-specify-unit">{text.weightUnit}</span>
                        <button
                          type="button"
                          className="mobile-specify-cancel-btn"
                          onPointerDown={() => {
                            isCancellingRef.current = true
                          }}
                          onClick={handleCancelSpecifying}
                          title={text.cancel}
                          aria-label={text.cancel}
                        >
                          <X size={15} aria-hidden="true" />
                        </button>
                      </div>
                      {inputError && <p className="text-xs text-red-500 mt-1">{inputError}</p>}
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="mobile-specify-trigger"
                      onClick={() => {
                        setSpecifying(true)
                        setInputError(null)
                      }}
                    >
                      <Plus size={13} aria-hidden="true" />
                      <span>{text.specifyBatWeight}</span>
                    </button>
                  )}
                </div>
              )}
            </section>

            {/* Geometry Dimensions Card */}
            <section className="mobile-card mobile-dimensions-card">
              <dl className="mobile-dims-list">
                {/* Length */}
                <div className="mobile-dim-row">
                  <dt>{text.retainedLength}</dt>
                  <dd>
                    {lengthFormatted ? (
                      <>
                        <span>{lengthFormatted.display}</span>
                        <span className="mobile-dim-unit">
                          {lengthUnit === 'in' ? text.inchUnit : text.centimetreUnit}
                        </span>
                        {lengthFormatted.secondary && (
                          <small className="text-zinc-500 font-normal text-xs">{lengthFormatted.secondary}</small>
                        )}
                      </>
                    ) : (
                      <span className="text-zinc-400">{text.missingValue}</span>
                    )}
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

              <div className="mobile-allowance-hint">
                <span>{text.diameterAllowance}：{formatCoordinate(diameterAllowanceMm)} {text.millimetreUnit}</span>
                <button
                  type="button"
                  className="mobile-allowance-edit-btn"
                  onClick={onMaterialOpen}
                  title={`${text.materialSettings} / ${text.diameterAllowance}`}
                >
                  <Settings2 size={12} aria-hidden="true" />
                  <span>{text.adjust}</span>
                </button>
              </div>

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

            {/* 3D Action Button: Positioned cleanly right below the dimensions table */}
            {calculated && result?.profile && (
              <button
                type="button"
                className="mobile-3d-action-button"
                onClick={() => setShow3d(true)}
              >
                <Box size={16} aria-hidden="true" />
                <span>{text.view3dPreviewButton}</span>
              </button>
            )}
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
