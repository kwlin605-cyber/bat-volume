import { useEffect, useId, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { positiveFinite, type WeightRange } from '../../domain/weight'
import { text } from '../../i18n/zh-TW'
import { parseRequirement } from './weight-input'
import type { WeightUnit } from '../../domain/weight-unit'
import { editableWeight, weightUnitLabel } from '../../lib/weight-display'

export function WeightEditor({ value, unit = 'g', onCommit, onCancel }: { value: WeightRange | null; unit?: WeightUnit; onCommit: (value: WeightRange | null) => void; onCancel: () => void }) {
  const [step, setStep] = useState<'min' | 'max'>('min')
  const [minimum, setMinimum] = useState(value ? editableWeight(value.min, unit) : '')
  const [maximum, setMaximum] = useState(value ? editableWeight(value.max, unit) : '')
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const errorId = useId()
  useEffect(() => { input.current?.focus(); input.current?.select() }, [step])
  function advance() {
    if (step === 'min') {
      if (!positiveFinite(Number(minimum))) { setError(text.invalidPositiveNumber); return }
      setError(''); setStep('max'); return
    }
    const parsed = parseRequirement(minimum, maximum, unit, value)
    if (parsed.error) { setError(parsed.error === 'range' ? text.invalidWeightRange : text.invalidPositiveNumber); return }
    onCommit(parsed.range)
  }
  return <div className="weight-editor">
    <div className="weight-editor-line">
      {step === 'max' && <><span className="weight-lower" title={minimum}>{minimum}</span><span>{text.weightRangeSeparator.trim()}</span></>}
      <input ref={input} type="number" inputMode="decimal" min="0" step="any" aria-label={step === 'min' ? text.minimumWeight : text.maximumWeight}
        aria-invalid={!!error} aria-describedby={error ? errorId : undefined} placeholder={step === 'min' ? text.minimumWeight : text.maximumWeight}
        value={step === 'min' ? minimum : maximum} onChange={event => { (step === 'min' ? setMinimum : setMaximum)(event.target.value); setError('') }}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); advance() } else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onCancel() } }} />
      {value && <button type="button" className="clear-weight" aria-label={text.clearRequirement} onClick={() => onCommit(null)}><X size={12} /></button>}
      <small className="weight-input-unit">{weightUnitLabel(unit)}</small>
    </div>
    {error && <span id={errorId} className="weight-input-error" role="alert">{error}</span>}
  </div>
}
