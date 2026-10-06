import { text } from '../i18n/zh-TW'

export const formatVolume = (value: number) => new Intl.NumberFormat(text.locale, { maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(value)
export const formatCoordinate = (value: number) => new Intl.NumberFormat(text.locale, { maximumFractionDigits: 2 }).format(value)
export const formatDimension = (value: number) => new Intl.NumberFormat(text.locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(value)
