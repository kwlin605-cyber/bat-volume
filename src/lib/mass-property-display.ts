import { text } from '../i18n/zh-TW'
import { fromMillimetres, type LengthUnit } from '../domain/length-unit'
import { inertiaFromKgM2, type InertiaUnit, type MassPropertyUnits } from '../domain/mass-property-units'
import type { BatProperties } from '../domain/bat-properties'
import { weightDisplay } from './weight-display'

export const balanceUnitLabel = (unit: LengthUnit) => unit === 'cm' ? text.centimetreUnit : text.inchUnit
export const inertiaUnitLabel = (unit: InertiaUnit) => unit === 'kg-cm2' ? text.kilogramCentimetresSquared : text.ounceInchesSquared
export const formatBalancePoint = (value: number, unit: LengthUnit) => new Intl.NumberFormat(text.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(fromMillimetres(value, unit))
export const formatInertia = (value: number, unit: InertiaUnit) => new Intl.NumberFormat(text.locale, { maximumFractionDigits: 0 }).format(inertiaFromKgM2(value, unit))
export function inertiaDisplay(range: BatProperties['moiKgM2'], unit: InertiaUnit) {
  if (!range) return text.missingValue
  const min = formatInertia(range.min, unit), max = formatInertia(range.max, unit)
  return min === max ? min : `${min}${text.weightRangeSeparator}${max}`
}
export function batPropertyDisplay(properties: BatProperties, units: MassPropertyUnits) {
  return [
    { id: 'weight', label: text.batWeight, display: properties.weightG ? weightDisplay(properties.weightG.min, properties.weightG.max, 'g').display : text.missingValue, unit: properties.weightG ? text.weightUnit : '' },
    { id: 'balancePoint', label: text.balancePoint, display: properties.balancePointMm === null ? text.missingValue : formatBalancePoint(properties.balancePointMm, units.balance), unit: properties.balancePointMm === null ? '' : balanceUnitLabel(units.balance) },
    { id: 'moi', label: text.momentOfInertia, display: inertiaDisplay(properties.moiKgM2, units.inertia), unit: properties.moiKgM2 ? inertiaUnitLabel(units.inertia) : '' },
  ]
}
