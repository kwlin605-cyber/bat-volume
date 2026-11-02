import { useEffect, useId, useRef, useState } from 'react'
import { materialDensity, positiveFinite, validWeightError, type MaterialSettings } from '../../domain/weight'
import { parseBladeWidth } from '../../domain/blade-width'
import { text } from '../../i18n/zh-TW'
import { formatCoordinate } from '../../lib/format'
import type { WeightDisplayMode } from '../../domain/weight-unit'
import { lengthDisplayModes, type LengthDisplayMode } from '../../domain/length-unit'
import { lengthModeLabel } from '../../lib/length-display'
import { UnitSelector } from './unit-selector'
import { WeightUnitSelector } from './weight-unit-selector'
import type { MassPropertyUnits } from '../../domain/mass-property-units'
import { MassPropertyUnitSelectors } from '../../components/mass-property-unit-selectors'

export function MaterialDialog({
  value,
  massUnits,
  onMassUnitsChange,
  weightUnit,
  lengthUnit,
  onWeightUnitChange,
  onLengthUnitChange,
  bladeWidthMm,
  onBladeWidthChange,
  onApply,
  onDismiss,
}: {
  value: MaterialSettings
  massUnits?: MassPropertyUnits
  onMassUnitsChange?: (value: MassPropertyUnits) => void
  weightUnit?: WeightDisplayMode
  lengthUnit?: LengthDisplayMode
  onWeightUnitChange?: (unit: WeightDisplayMode) => void
  onLengthUnitChange?: (unit: LengthDisplayMode) => void
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
  const [bladeWidth, setBladeWidth] = useState(bladeWidthMm ? String(bladeWidthMm) : '')
  const [draftWeightUnit, setDraftWeightUnit] = useState(weightUnit ?? 'oz')
  const [draftLengthUnit, setDraftLengthUnit] = useState(lengthUnit ?? 'in')
  const [error, setError] = useState('')
  const [draftMassUnits, setDraftMassUnits] = useState(massUnits)

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

    const nextBladeWidth = parseBladeWidth(bladeWidth)
    if (bladeWidthMm !== undefined && onBladeWidthChange && nextBladeWidth === null) {
      setError(text.invalidPositiveNumber)
      return
    }

    if (bladeWidthMm !== undefined && nextBladeWidth !== null && nextBladeWidth !== bladeWidthMm) {
      onBladeWidthChange?.(nextBladeWidth)
    }
    if (draftWeightUnit !== weightUnit) onWeightUnitChange?.(draftWeightUnit)
    if (draftLengthUnit !== lengthUnit) onLengthUnitChange?.(draftLengthUnit)

    if (draftMassUnits && onMassUnitsChange) onMassUnitsChange(draftMassUnits)
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

        {(onLengthUnitChange || onWeightUnitChange || (draftMassUnits && onMassUnitsChange)) && (
          <div className="material-unit-preferences">
            {onLengthUnitChange && <UnitSelector label={text.lengthDisplayUnit} modes={lengthDisplayModes} value={draftLengthUnit} modeLabel={lengthModeLabel} onChange={setDraftLengthUnit} />}
            {onWeightUnitChange && <WeightUnitSelector value={draftWeightUnit} onChange={setDraftWeightUnit} />}
            {draftMassUnits && onMassUnitsChange && <MassPropertyUnitSelectors value={draftMassUnits} onChange={setDraftMassUnits} />}
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
