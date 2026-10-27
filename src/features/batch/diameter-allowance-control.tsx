import { useEffect, useRef, useState } from 'react'
import { parseDiameterAllowance } from '../../domain/diameter-allowance'
import { text } from '../../i18n/zh-TW'

export function DiameterAllowanceControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value))
  const [invalid, setInvalid] = useState(false)
  const cancelled = useRef(false)
  useEffect(() => { setDraft(String(value)); setInvalid(false) }, [value])
  function commit() {
    if (cancelled.current) { cancelled.current = false; return }
    const next = parseDiameterAllowance(draft)
    if (next === null) { setInvalid(true); return }
    setInvalid(false)
    if (next !== value) onChange(next)
  }
  return <form className="diameter-allowance-control" noValidate onSubmit={event => { event.preventDefault(); commit() }}>
    <label><span>{text.diameterAllowance}</span><span className="diameter-allowance-input">
      <input type="number" min="0" step="any" aria-label={text.diameterAllowance} aria-invalid={invalid || undefined}
        value={draft} onChange={event => { cancelled.current = false; setDraft(event.target.value); setInvalid(false) }} onBlur={commit}
        onKeyDown={event => { if (event.key === 'Escape') { cancelled.current = true; setDraft(String(value)); setInvalid(false) } }} />
      <small>{text.millimetreUnit}</small>
    </span></label>
  </form>
}
