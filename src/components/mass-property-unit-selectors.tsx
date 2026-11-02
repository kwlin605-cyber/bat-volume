import { UnitSelector } from '../features/batch/unit-selector'
import { balanceUnits, inertiaUnits, type MassPropertyUnits } from '../domain/mass-property-units'
import { balanceUnitLabel, inertiaUnitLabel } from '../lib/mass-property-display'
import { text } from '../i18n/zh-TW'

export function MassPropertyUnitSelectors({ value, onChange }: { value: MassPropertyUnits; onChange: (value: MassPropertyUnits) => void }) {
  return <>
    <UnitSelector label={text.balancePointUnit} modes={balanceUnits} value={value.balance} modeLabel={balanceUnitLabel} onChange={balance => onChange({ ...value, balance })} />
    <UnitSelector label={text.momentOfInertiaUnit} modes={inertiaUnits} value={value.inertia} modeLabel={inertiaUnitLabel} onChange={inertia => onChange({ ...value, inertia })} />
  </>
}
