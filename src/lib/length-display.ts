import { fromMillimetres, type LengthDisplayMode } from '../domain/length-unit'
import { formatDimension } from './format'
import { text } from '../i18n/zh-TW'

/** Quarter-inch rounding is a presentation rule, shared by the table and exports. */
export const quarterInchValue = (mm: number) => {
  const steps = fromMillimetres(mm, 'in') * 4
  return Math.round(steps + Number.EPSILON * Math.abs(steps) * 2) / 4
}
export const lengthModeLabel = (mode: LengthDisplayMode) => mode === 'both' ? text.bothUnits : mode === 'in' ? text.inches : text.centimetreUnit
export const lengthHeaderUnit = (mode: LengthDisplayMode) => mode === 'both' ? `${text.centimetreUnit} / ${text.inchUnit}` : mode === 'in' ? text.inchUnit : text.centimetreUnit
export const lengthNumberFormat = (mode: LengthDisplayMode, mm?: number) => {
  if (mode !== 'in') return '#,##0.0'
  if (mm === undefined) return '#,##0.##'
  const inches = quarterInchValue(mm)
  return Number.isInteger(inches) ? '#,##0' : Number.isInteger(inches * 2) ? '#,##0.0' : '#,##0.00'
}
export function lengthDisplay(mm: number, mode: LengthDisplayMode): { display: string; secondary?: string } {
  const inches = () => new Intl.NumberFormat(text.locale, { maximumFractionDigits: 2 }).format(quarterInchValue(mm))
  return mode === 'both'
    ? { display: formatDimension(fromMillimetres(mm, 'cm')), secondary: `${inches()} ${text.inchUnit}` }
    : { display: mode === 'in' ? inches() : formatDimension(fromMillimetres(mm, 'cm')) }
}
