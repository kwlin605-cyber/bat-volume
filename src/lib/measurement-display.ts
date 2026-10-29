import type { MeasurementRange } from '../domain/types'
import { fromMillimetres } from '../domain/length-unit'
import { text } from '../i18n/zh-TW'

const formatter = new Intl.NumberFormat(text.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export type MeasurementEnd = 'head' | 'grip'
export const measurementEndLabel = (end: MeasurementEnd) => end === 'head' ? text.fromHead : text.fromButt

export function formatMeasurementDistance(ranges: readonly MeasurementRange[] | null | undefined): string {
  if (!ranges?.length) return text.missingValue
  return ranges.map(range => {
    const start = formatter.format(fromMillimetres(range.startMm, 'cm'))
    const end = formatter.format(fromMillimetres(range.endMm, 'cm'))
    return start === end ? start : `${start}${text.measurementRangeSeparator}${end}`
  }).join(text.measurementListSeparator)
}

export function measurementCaption(ranges: readonly MeasurementRange[] | null | undefined, end: MeasurementEnd): string {
  const value = formatMeasurementDistance(ranges)
  return `${measurementEndLabel(end)} ${value}${ranges?.length ? ` ${text.centimetreUnit}` : ''}`
}
