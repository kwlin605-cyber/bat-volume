import { useEffect, useId, useRef, useState } from 'react'
import { materialDensity, positiveFinite, validWeightError, type MaterialSettings } from '../../domain/weight'
import { parseDiameterAllowance } from '../../domain/diameter-allowance'
import { parseBladeWidth } from '../../domain/blade-width'
import { text } from '../../i18n/zh-TW'
import { formatCoordinate } from '../../lib/format'
import type { WeightDisplayMode } from '../../domain/weight-unit'
import type { LengthDisplayMode } from '../../domain/length-unit'

export function MaterialDialog({
  value,
  weightUnit,
  lengthUnit,
  onWeightUnitChange,
  onLengthUnitChange,
  diameterAllowanceMm,
  onDiameterAllowanceChange,
  bladeWidthMm,
  onBladeWidthChange,
  onApply,
  onDismiss,
}: {
  value: MaterialSettings
  weightUnit?: WeightDisplayMode
  lengthUnit?: LengthDisplayMode
  onWeightUnitChange?: (unit: WeightDisplayMode) => void
  onLengthUnitChange?: (unit: LengthDisplayMode) => void
  diameterAllowanceMm?: number
  onDiameterAllowanceChange?: (value: number) => void
  bladeWidthMm?: number
  onBladeWidthChange?: (value: number) => void
  onApply: (value: MaterialSettings) => void
  onDismiss: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [density, setDensity] = useState(value.referenceDensity?.toString() ?? '')
  const [volume, setVolume] = useState(value.volumeCm3?.toString() ?? '')
  const [weight, setWeight] = useState(value.weightG?.toString() ?? '')
  const [weightError, setWeightError] = useState(value.weightErrorPercent ? String(value.weightErrorPercent) : '')
  const [allowance, setAllowance] = useState(diameterAllowanceMm ? String(diameterAllowanceMm) : '')
  const [bladeWidth, setBladeWidth] = useState(bladeWidthMm ? String(bladeWidthMm) : '')
  const [draftWeightUnit, setDraftWeightUnit] = useState(weightUnit ?? 'oz')
  const [draftLengthUnit, setDraftLengthUnit] = useState(lengthUnit ?? 'in')
  const [error, setError] = useState('')

  const weightG = weight.trim() ? Number(weight) : null

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal()
  }, [])

  function apply() {
    const settings: MaterialSettings = {
      referenceDensity: density.trim() ? Number(density) : null,
      volumeCm3: volume.trim() ? Number(volume) : null,
      weightG,
      weightErrorPercent: weightError.trim() ? Number(weightError) : 0,
    }
    if (
      (settings.referenceDensity !== null && !positiveFinite(settings.referenceDensity)) ||
      (settings.volumeCm3 !== null && !positiveFinite(settings.volumeCm3)) ||
      (settings.weightG !== null && !positiveFinite(settings.weightG))
    ) {
      setError(text.invalidPositiveNumber)
      return
    }
    if (settings.weightErrorPercent !== null && !validWeightError(settings.weightErrorPercent)) {
      setError(text.invalidWeightError)
      return
    }

    const nextAllowance = parseDiameterAllowance(allowance)
    const nextBladeWidth = parseBladeWidth(bladeWidth)
    if ((diameterAllowanceMm !== undefined && onDiameterAllowanceChange && nextAllowance === null)
      || (bladeWidthMm !== undefined && onBladeWidthChange && nextBladeWidth === null)) {
      setError(text.invalidPositiveNumber)
      return
    }

    if (diameterAllowanceMm !== undefined && nextAllowance !== null && nextAllowance !== diameterAllowanceMm) {
      onDiameterAllowanceChange?.(nextAllowance)
    }
    if (bladeWidthMm !== undefined && nextBladeWidth !== null && nextBladeWidth !== bladeWidthMm) {
      onBladeWidthChange?.(nextBladeWidth)
    }
    if (draftWeightUnit !== weightUnit) onWeightUnitChange?.(draftWeightUnit)
    if (draftLengthUnit !== lengthUnit) onLengthUnitChange?.(draftLengthUnit)

    onApply(settings)
    onDismiss()
  }

  const draft: MaterialSettings = {
    referenceDensity: Number(density),
    volumeCm3: Number(volume),
    weightG,
    weightErrorPercent: Number(weightError),
  }
  const actualDensity = positiveFinite(draft.volumeCm3) && positiveFinite(draft.weightG) ? materialDensity(draft) : null

  return (
    <dialog
      ref={dialog}
      className="material-dialog"
      aria-labelledby={titleId}
      onClose={onDismiss}
      onClick={event => {
        if (event.target === event.currentTarget) dialog.current?.close()
      }}
    >
      <form onSubmit={event => { event.preventDefault(); apply() }}>
        <h2 id={titleId}>{text.materialSettings}</h2>
        <label className="material-field">
          <span>{text.referenceDensity}</span>
          <div>
            <input
              type="number"
              aria-label={text.referenceDensity}
              inputMode="decimal"
              min="0"
              step="any"
              placeholder={text.optionalField}
              value={density}
              onChange={event => { setDensity(event.target.value); setError('') }}
            />
            <small>{text.densityUnit}</small>
          </div>
        </label>
        <label className="material-field">
          <span>{text.materialVolume}</span>
          <div>
            <input
              type="number"
              aria-label={text.materialVolume}
              inputMode="decimal"
              min="0"
              step="any"
              placeholder={text.optionalField}
              value={volume}
              onChange={event => { setVolume(event.target.value); setError('') }}
            />
            <small>{text.volumeUnit}</small>
          </div>
        </label>
        <label className="material-field">
          <span>{text.materialWeight}</span>
          <div>
            <input
              type="number"
              aria-label={text.materialWeight}
              inputMode="decimal"
              min="0"
              step="any"
              placeholder={text.optionalField}
              value={weight}
              onChange={event => { setWeight(event.target.value); setError('') }}
            />
            <small>{text.weightUnit}</small>
          </div>
        </label>
        {actualDensity !== null && (
          <p className="effective-density">
            {text.densityInUse} {formatCoordinate(actualDensity)} {text.densityUnit}
          </p>
        )}
        <label className="material-field">
          <span>{text.measuredWeightError}</span>
          <div>
            <input
              type="number"
              aria-label={text.measuredWeightError}
              inputMode="text"
              step="any"
              placeholder={text.optionalField}
              value={weightError}
              onChange={event => { setWeightError(event.target.value); setError('') }}
            />
            <small>{text.percentUnit}</small>
          </div>
        </label>
        {diameterAllowanceMm !== undefined && onDiameterAllowanceChange && (
          <label className="material-field">
            <span>{text.diameterAllowance}</span>
            <div>
              <input
                type="number"
                aria-label={text.diameterAllowance}
                inputMode="decimal"
                min="0"
                step="any"
                placeholder={text.optionalField}
                value={allowance}
                onChange={event => { setAllowance(event.target.value); setError('') }}
              />
              <small>{text.millimetreUnit}</small>
            </div>
          </label>
        )}
        {bladeWidthMm !== undefined && onBladeWidthChange && (
          <label className="material-field">
            <span>{text.bladeWidth}</span>
            <div>
              <input
                type="number"
                aria-label={text.bladeWidth}
                inputMode="decimal"
                min="0"
                step="any"
                placeholder={text.optionalField}
                value={bladeWidth}
                onChange={event => { setBladeWidth(event.target.value); setError('') }}
              />
              <small>{text.millimetreUnit}</small>
            </div>
          </label>
        )}

        {(onLengthUnitChange || onWeightUnitChange) && (
          <div className="material-unit-preferences">
            {onLengthUnitChange && (
              <div className="material-unit-row">
                <span className="material-unit-label">{text.lengthDisplayUnit}</span>
                <div className="material-segmented-group" role="group" aria-label={text.lengthDisplayUnit}>
                  <button
                    type="button"
                    className={`material-segmented-btn ${draftLengthUnit === 'cm' ? 'is-active' : ''}`}
                    aria-pressed={draftLengthUnit === 'cm'}
                    onClick={() => setDraftLengthUnit('cm')}
                  >
                    {text.centimetreToggleLabel}
                  </button>
                  <button
                    type="button"
                    className={`material-segmented-btn ${draftLengthUnit === 'in' ? 'is-active' : ''}`}
                    aria-pressed={draftLengthUnit === 'in'}
                    onClick={() => setDraftLengthUnit('in')}
                  >
                    {text.inchToggleLabel}
                  </button>
                  <button
                    type="button"
                    className={`material-segmented-btn ${draftLengthUnit === 'both' ? 'is-active' : ''}`}
                    aria-pressed={draftLengthUnit === 'both'}
                    onClick={() => setDraftLengthUnit('both')}
                  >
                    {text.bothUnits}
                  </button>
                </div>
              </div>
            )}
            {onWeightUnitChange && (
              <div className="material-unit-row">
                <span className="material-unit-label">{text.weightDisplayUnit}</span>
                <div className="material-segmented-group" role="group" aria-label={text.weightDisplayUnit}>
                  <button
                    type="button"
                    className={`material-segmented-btn ${draftWeightUnit === 'g' ? 'is-active' : ''}`}
                    aria-pressed={draftWeightUnit === 'g'}
                    onClick={() => setDraftWeightUnit('g')}
                  >
                    {text.gramToggleLabel}
                  </button>
                  <button
                    type="button"
                    className={`material-segmented-btn ${draftWeightUnit === 'oz' ? 'is-active' : ''}`}
                    aria-pressed={draftWeightUnit === 'oz'}
                    onClick={() => setDraftWeightUnit('oz')}
                  >
                    {text.ounceToggleLabel}
                  </button>
                  <button
                    type="button"
                    className={`material-segmented-btn ${draftWeightUnit === 'both' ? 'is-active' : ''}`}
                    aria-pressed={draftWeightUnit === 'both'}
                    onClick={() => setDraftWeightUnit('both')}
                  >
                    {text.bothWeightUnits}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {error && <p className="weight-input-error" role="alert">{error}</p>}
        <div className="material-actions">
          <button type="button" onClick={onDismiss}>{text.cancel}</button>
          <button type="submit">{text.applySettings}</button>
        </div>
      </form>
    </dialog>
  )
}
