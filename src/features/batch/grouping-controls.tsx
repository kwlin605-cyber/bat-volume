import { useEffect, useRef, useState } from 'react'
import { ArrowDownUp } from 'lucide-react'
import { validDiameterThreshold, type BatGroupingSettings } from '../../domain/bat-grouping'
import { text } from '../../i18n/zh-TW'

/** Draft validation belongs to the menu; only valid completed inputs change grouping. */
export function GroupingControls({ value, onChange }: { value: BatGroupingSettings; onChange: (next: BatGroupingSettings) => void }) {
  const [draft, setDraft] = useState(String(value.diameterThresholdMm))
  const [invalid, setInvalid] = useState(false)
  const cancelled = useRef(false)
  useEffect(() => { setDraft(String(value.diameterThresholdMm)); setInvalid(false) }, [value.diameterThresholdMm])
  function commit() {
    if (cancelled.current) { cancelled.current = false; return }
    const threshold = Number(draft)
    if (!validDiameterThreshold(threshold)) { setInvalid(true); return }
    setInvalid(false)
    if (threshold !== value.diameterThresholdMm) onChange({ ...value, diameterThresholdMm: threshold })
  }
  return <div className="grouping-controls">
    <button type="button" className="grouping-order" title={text.swapBatGroups} onClick={() => onChange({ ...value, firstGroup: value.firstGroup === 'softball' ? 'baseball' : 'softball' })}>
      <span>{value.firstGroup === 'softball' ? text.softballFirst : text.baseballFirst}</span><ArrowDownUp size={15} aria-hidden="true" />
    </button>
    <form onSubmit={event => { event.preventDefault(); commit() }}>
      <label className="grouping-threshold"><span>{text.diameterThreshold}</span><span className="grouping-threshold-input">
        <input type="number" step="any" aria-label={text.diameterThreshold} aria-invalid={invalid || undefined} aria-describedby={invalid ? 'grouping-threshold-error' : undefined}
          value={draft} onChange={event => { cancelled.current = false; setDraft(event.target.value); setInvalid(false) }} onBlur={commit}
          onKeyDown={event => { if (event.key === 'Escape') { cancelled.current = true; setDraft(String(value.diameterThresholdMm)); setInvalid(false) } }} />
        <small>{text.lengthUnit}</small>
      </span></label>
      {invalid && <p id="grouping-threshold-error" className="grouping-error" role="alert">{text.invalidPositiveNumber}</p>}
    </form>
  </div>
}
