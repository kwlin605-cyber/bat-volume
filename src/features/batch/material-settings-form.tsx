import { useState } from 'react'
import { materialDensity, positiveFinite, validWeightError, type MaterialSettings } from '../../domain/weight'
import { parseBladeWidth } from '../../domain/blade-width'
import { text } from '../../i18n/zh-TW'
import { formatCoordinate } from '../../lib/format'

export interface MaterialSettingsFormProps {
  value: MaterialSettings
  bladeWidthMm?: number
  onBladeWidthChange?: (value: number) => void
  onApply: (value: MaterialSettings) => void
  onDismiss: () => void
}

export function MaterialSettingsForm({ value, bladeWidthMm, onBladeWidthChange, onApply, onDismiss }: MaterialSettingsFormProps) {
  const [density, setDensity] = useState(value.referenceDensity?.toString() ?? '')
  const [volume, setVolume] = useState(value.volumeCm3?.toString() ?? '')
  const [weight, setWeight] = useState(value.weightG?.toString() ?? '')
  const [weightError, setWeightError] = useState(value.weightErrorPercent ? String(value.weightErrorPercent) : '')
  const [bladeWidth, setBladeWidth] = useState(bladeWidthMm ? String(bladeWidthMm) : '')
  const [error, setError] = useState('')

  const weightG = weight.trim() ? Number(weight) : null

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
    <form onSubmit={event => { event.preventDefault(); apply() }}>
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

      {error && <p className="weight-input-error" role="alert">{error}</p>}
      <div className="material-actions">
        <button type="button" onClick={onDismiss}>{text.cancel}</button>
        <button type="submit">{text.applySettings}</button>
      </div>
    </form>
  )
}
