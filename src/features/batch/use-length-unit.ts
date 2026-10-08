import { useState } from 'react'
import type { LengthDisplayMode } from '../../domain/length-unit'
import { readLengthUnit, saveLengthUnit } from '../../services/length-unit-storage'

export function useLengthUnit() {
  const [loaded] = useState(() => {
    try { return readLengthUnit(window.localStorage) }
    catch { return { mode: 'mm' as LengthDisplayMode, unavailable: true } }
  })
  const [mode, setMode] = useState<LengthDisplayMode>(loaded.mode)
  const [storageUnavailable, setStorageUnavailable] = useState(loaded.unavailable)
  function selectMode(next: LengthDisplayMode) {
    setMode(next)
    try { setStorageUnavailable(!saveLengthUnit(window.localStorage, next)) }
    catch { setStorageUnavailable(true) }
  }
  return { mode, selectMode, storageUnavailable }
}
