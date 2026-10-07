import { weightDisplayModes, type WeightDisplayMode } from '../../domain/weight-unit'
import { weightModeLabel } from '../../lib/weight-display'
import { text } from '../../i18n/zh-TW'

export function WeightUnitSelector({ value, onChange }: { value: WeightDisplayMode; onChange: (mode: WeightDisplayMode) => void }) {
  return <fieldset className="weight-unit-selector"><legend>{text.weightDisplayUnit}</legend>
    <div>{weightDisplayModes.map(mode => <button key={mode} type="button" aria-pressed={value === mode} onClick={() => onChange(mode)}>{weightModeLabel(mode)}</button>)}</div>
  </fieldset>
}
