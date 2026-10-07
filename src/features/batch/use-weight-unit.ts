import { useState } from 'react'
import type { WeightDisplayMode } from '../../domain/weight-unit'
import { readWeightUnit, saveWeightUnit } from '../../services/weight-unit-storage'

export function useWeightUnit() {
  const [loaded] = useState(() => {
    try { return readWeightUnit(window.localStorage) }
    catch { return { mode: 'g' as WeightDisplayMode, unavailable: true } }
  })
  const [mode, setMode] = useState<WeightDisplayMode>(loaded.mode)
  const [storageUnavailable, setStorageUnavailable] = useState(loaded.unavailable)
  function selectMode(next: WeightDisplayMode) {
    setMode(next)
    try { setStorageUnavailable(!saveWeightUnit(window.localStorage, next)) }
    catch { setStorageUnavailable(true) }
  }
  return { mode, selectMode, storageUnavailable }
}
