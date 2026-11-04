import type { WeightDisplayMode } from '../../domain/weight-unit'
import { lengthDisplayModes, type LengthDisplayMode } from '../../domain/length-unit'
import type { MassPropertyUnits } from '../../domain/mass-property-units'
import { lengthModeLabel } from '../../lib/length-display'
import { text } from '../../i18n/zh-TW'
import { MassPropertyUnitSelectors } from '../../components/mass-property-unit-selectors'
import { UnitSelector } from './unit-selector'
import { WeightUnitSelector } from './weight-unit-selector'

export function DisplayUnitSettings({ weightUnit, lengthUnit, massUnits, onWeightUnitChange, onLengthUnitChange, onMassUnitsChange }: {
  weightUnit: WeightDisplayMode
  lengthUnit: LengthDisplayMode
  massUnits: MassPropertyUnits
  onWeightUnitChange: (value: WeightDisplayMode) => void
  onLengthUnitChange: (value: LengthDisplayMode) => void
  onMassUnitsChange: (value: MassPropertyUnits) => void
}) {
  return (
    <div className="settings-unit-preferences">
      <UnitSelector label={text.lengthDisplayUnit} modes={lengthDisplayModes} value={lengthUnit} modeLabel={lengthModeLabel} onChange={onLengthUnitChange} />
      <WeightUnitSelector value={weightUnit} onChange={onWeightUnitChange} />
      <MassPropertyUnitSelectors value={massUnits} onChange={onMassUnitsChange} />
    </div>
  )
}
