import { useState } from 'react'
import { defaultDiameterAllowanceMm, validDiameterAllowance } from '../domain/diameter-allowance'
import { readDiameterAllowance, saveDiameterAllowance } from '../services/diameter-allowance-storage'

/** One preference shared by desktop results, the preview card and mobile cards. */
export function useDiameterAllowance() {
  const [loaded] = useState(() => {
    try { return readDiameterAllowance(window.localStorage) }
    catch { return { value: defaultDiameterAllowanceMm, unavailable: true } }
  })
  const [allowanceMm, setAllowanceMm] = useState(loaded.value)
  const [storageUnavailable, setStorageUnavailable] = useState(loaded.unavailable)
  function applyAllowance(next: number) {
    if (!validDiameterAllowance(next)) return
    setAllowanceMm(next)
    try { setStorageUnavailable(!saveDiameterAllowance(window.localStorage, next)) }
    catch { setStorageUnavailable(true) }
  }
  return { allowanceMm, applyAllowance, storageUnavailable }
}
