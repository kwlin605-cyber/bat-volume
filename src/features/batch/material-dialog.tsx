import { useEffect, useId, useRef, useState } from 'react'
import { materialDensity, positiveFinite, type MaterialSettings } from '../../domain/weight'
import { text } from '../../i18n/zh-TW'
import { formatCoordinate } from '../../lib/format'
import { toGrams, type WeightUnit } from '../../domain/weight-unit'
import { editableWeight, weightUnitLabel } from '../../lib/weight-display'

export function MaterialDialog({ value, unit = 'g', onApply, onDismiss }: { value: MaterialSettings; unit?: WeightUnit; onApply: (value: MaterialSettings) => void; onDismiss: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [density, setDensity] = useState(value.referenceDensity.toString())
  const [volume, setVolume] = useState(value.volumeCm3?.toString() ?? '')
  const [weight, setWeight] = useState(value.weightG === null ? '' : editableWeight(value.weightG, unit))
  const [error, setError] = useState('')
  const weightG = weight.trim() ? (value.weightG !== null && weight === editableWeight(value.weightG, unit) ? value.weightG : toGrams(Number(weight), unit)) : null
  useEffect(() => { if (dialog.current && !dialog.current.open) dialog.current.showModal() }, [])
  function apply() {
    const settings: MaterialSettings = { referenceDensity: Number(density), volumeCm3: volume.trim() ? Number(volume) : null, weightG }
    if (!positiveFinite(settings.referenceDensity) || (settings.volumeCm3 !== null && !positiveFinite(settings.volumeCm3)) || (settings.weightG !== null && !positiveFinite(settings.weightG))) {
      setError(text.invalidPositiveNumber); return
    }
    onApply(settings); onDismiss()
  }
  const draft: MaterialSettings = { referenceDensity: Number(density), volumeCm3: Number(volume), weightG }
  const actualDensity = positiveFinite(draft.volumeCm3) && positiveFinite(draft.weightG) ? materialDensity(draft) : null
  return <dialog ref={dialog} className="material-dialog" aria-labelledby={titleId} onClose={onDismiss} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }}>
    <form onSubmit={event => { event.preventDefault(); apply() }}>
      <h2 id={titleId}>{text.materialSettings}</h2>
      <label className="material-field"><span>{text.referenceDensity}</span><div><input type="number" aria-label={text.referenceDensity} inputMode="decimal" min="0" step="any" required value={density} onChange={event => { setDensity(event.target.value); setError('') }} /><small>{text.densityUnit}</small></div></label>
      <label className="material-field"><span>{text.materialVolume}</span><div><input type="number" aria-label={text.materialVolume} inputMode="decimal" min="0" step="any" placeholder={text.optionalField} value={volume} onChange={event => { setVolume(event.target.value); setError('') }} /><small>{text.volumeUnit}</small></div></label>
      <label className="material-field"><span>{text.materialWeight}</span><div><input type="number" aria-label={text.materialWeight} inputMode="decimal" min="0" step="any" placeholder={text.optionalField} value={weight} onChange={event => { setWeight(event.target.value); setError('') }} /><small>{weightUnitLabel(unit)}</small></div></label>
      {actualDensity !== null && <p className="effective-density">{text.densityInUse} {formatCoordinate(actualDensity)} {text.densityUnit}</p>}
      {error && <p className="weight-input-error" role="alert">{error}</p>}
      <div className="material-actions"><button type="button" onClick={onDismiss}>{text.cancel}</button><button type="submit">{text.applySettings}</button></div>
    </form>
  </dialog>
}
