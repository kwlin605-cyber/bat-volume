import { fromMillimetres, type LengthDisplayMode } from '../domain/length-unit'
import { formatDimension } from './format'
import { text } from '../i18n/zh-TW'

/** Half-inch rounding is a presentation rule, shared by the table and exports. */
export const halfInchValue = (mm: number) => {
  const steps = fromMillimetres(mm, 'in') * 2
  return Math.round(steps + Number.EPSILON * Math.abs(steps) * 2) / 2
}
export const lengthModeLabel = (mode: LengthDisplayMode) => mode === 'both' ? text.bothUnits : mode === 'in' ? text.inches : text.lengthUnit
export const lengthHeaderUnit = (mode: LengthDisplayMode) => mode === 'both' ? `${text.lengthUnit} / ${text.inchUnit}` : mode === 'in' ? text.inchUnit : text.lengthUnit
export const lengthNumberFormat = (mode: LengthDisplayMode, mm?: number) => mode === 'in' && mm !== undefined && Number.isInteger(halfInchValue(mm)) ? '#,##0' : '#,##0.0'
export function lengthDisplay(mm: number, mode: LengthDisplayMode): { display: string; secondary?: string } {
  const inches = () => new Intl.NumberFormat(text.locale, { maximumFractionDigits: 1 }).format(halfInchValue(mm))
  return mode === 'both'
    ? { display: `${formatDimension(mm)} ${text.lengthUnit}`, secondary: `${inches()} ${text.inchUnit}` }
    : { display: mode === 'in' ? inches() : formatDimension(mm) }
}
