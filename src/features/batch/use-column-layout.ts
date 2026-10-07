import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { batchTableStyle } from '../../config/batch'
import { createTextMeasure } from '../../lib/measure-text'
import { buildColumnLayout, textUnits, type TextMeasure } from './column-layout'
import type { BatchView } from './view-model'

const fallbackMeasure: TextMeasure = (value, font) => textUnits(value) * font.size * 0.6

export function useColumnLayout(view: BatchView) {
  const areaRef = useRef<HTMLDivElement>(null)
  const [availableWidth, setAvailableWidth] = useState(Infinity)
  const [measure, setMeasure] = useState<TextMeasure>(() => fallbackMeasure)
  useLayoutEffect(() => {
    const area = areaRef.current
    if (!area) return
    let active = true
    const updateMeasure = () => {
      if (active) setMeasure(() => createTextMeasure(getComputedStyle(area).fontFamily))
    }
    const observer = new ResizeObserver(([entry]) => setAvailableWidth(Math.max(0, entry.contentRect.width - 2)))
    observer.observe(area)
    updateMeasure()
    void document.fonts.ready.then(updateMeasure)
    document.fonts.addEventListener('loadingdone', updateMeasure)
    return () => { active = false; observer.disconnect(); document.fonts.removeEventListener('loadingdone', updateMeasure) }
  }, [])
  const layout = useMemo(() => buildColumnLayout(view, batchTableStyle, measure, availableWidth), [view, measure, availableWidth])
  return { areaRef, layout }
}
