import { weightDisplayModes, type WeightDisplayMode } from '../../domain/weight-unit'
import { weightModeLabel } from '../../lib/weight-display'
import { text } from '../../i18n/zh-TW'
import { UnitSelector } from './unit-selector'

export function WeightUnitSelector({ value, onChange }: { value: WeightDisplayMode; onChange: (mode: WeightDisplayMode) => void }) {
  return <UnitSelector label={text.weightDisplayUnit} modes={weightDisplayModes} value={value} modeLabel={weightModeLabel} onChange={onChange} />
}
