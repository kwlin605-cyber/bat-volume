import { useState } from 'react'
import { defaultBladeWidthMm, validBladeWidth } from '../domain/blade-width'
import { readBladeWidth, saveBladeWidth } from '../services/blade-width-storage'

/** One blade width preference shared across desktop results, preview cards and mobile cards. */
export function useBladeWidth() {
  const [loaded] = useState(() => {
    try {
      return readBladeWidth(window.localStorage)
    } catch {
      return { value: defaultBladeWidthMm, unavailable: true }
    }
  })
  const [widthMm, setWidthMm] = useState(loaded.value)
  const [storageUnavailable, setStorageUnavailable] = useState(loaded.unavailable)

  function applyBladeWidth(next: number) {
    if (!validBladeWidth(next)) return
    setWidthMm(next)
    try {
      setStorageUnavailable(!saveBladeWidth(window.localStorage, next))
    } catch {
      setStorageUnavailable(true)
    }
  }

  return { widthMm, applyBladeWidth, storageUnavailable }
}
