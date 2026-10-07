import type { TextMeasure } from '../features/batch/column-layout'

export function createTextMeasure(fontFamily: string, sizeScale = 1, unitSize = 1): TextMeasure {
  const context = document.createElement('canvas').getContext('2d')
  if (!context) throw new Error('Text measurement unavailable')
  const cache = new Map<string, number>()
  return (value, font) => {
    const key = `${font.size}:${font.weight}:${font.letterSpacing ?? 0}:${font.tabular ?? false}:${value}`
    const cached = cache.get(key)
    if (cached !== undefined) return cached
    context.font = `${font.weight} ${font.size * sizeScale}px ${fontFamily}`
    const digitWidth = font.tabular ? Math.max(...Array.from('0123456789', digit => context.measureText(digit).width)) : 0
    const measuredWidth = font.tabular ? [...value].reduce((sum, character) => sum + (/\d/.test(character) ? digitWidth : context.measureText(character).width), 0) : context.measureText(value).width
    const width = (measuredWidth + Math.max(0, [...value].length - 1) * (font.letterSpacing ?? 0) * sizeScale) / unitSize
    cache.set(key, width)
    return width
  }
}
