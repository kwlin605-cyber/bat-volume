import { fromGrams, type WeightDisplayMode, type WeightUnit } from '../domain/weight-unit'
import { text } from '../i18n/zh-TW'

export const weightUnitLabel = (unit: WeightUnit) => unit === 'oz' ? text.ounceUnit : text.weightUnit
export const weightModeLabel = (mode: WeightDisplayMode) => mode === 'both' ? text.bothWeightUnits : weightUnitLabel(mode)
export const weightHeaderUnit = (mode: WeightDisplayMode) => mode === 'both' ? `${text.weightUnit} / ${text.ounceUnit}` : weightUnitLabel(mode)
export const weightNumberFormat = (mode: WeightDisplayMode) => mode === 'oz' ? '#,##0.0' : '#,##0'

export function formatWeightInUnit(grams: number, unit: WeightUnit) {
  const digits = unit === 'oz' ? 1 : 0
  return new Intl.NumberFormat(text.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(fromGrams(grams, unit))
}
export function weightDisplay(grams: number, maximum: number | undefined, mode: WeightDisplayMode): { display: string; secondary?: string } {
  const range = (unit: WeightUnit) => maximum !== undefined && maximum !== grams
    ? `${formatWeightInUnit(grams, unit)}${text.weightRangeSeparator}${formatWeightInUnit(maximum, unit)}`
    : formatWeightInUnit(grams, unit)
  return mode === 'both'
    ? { display: `${range('g')} ${text.weightUnit}`, secondary: `${range('oz')} ${text.ounceUnit}` }
    : { display: range(mode) }
}
/** Editable text may be concise; unchanged inputs reuse the original gram value. */
export const editableWeight = (grams: number, unit: WeightUnit) => unit === 'g' ? String(grams) : String(Number(fromGrams(grams, unit).toFixed(6)))
