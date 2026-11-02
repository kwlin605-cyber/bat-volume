import { useState } from 'react'
import { normalizeMassPropertyUnits, type MassPropertyUnits } from '../domain/mass-property-units'
import { readMassPropertyUnits, saveMassPropertyUnits } from '../services/mass-property-unit-storage'

export function useMassPropertyUnits() {
  const [loaded] = useState(() => {
    try { return readMassPropertyUnits(localStorage) }
    catch { return { units: normalizeMassPropertyUnits(null), unavailable: true } }
  })
  const [units, setUnits] = useState(loaded.units)
  const [storageUnavailable, setUnavailable] = useState(loaded.unavailable)
  function applyUnits(value: MassPropertyUnits) {
    const next = normalizeMassPropertyUnits(value)
    setUnits(next)
    try { setUnavailable(!saveMassPropertyUnits(localStorage, next)) }
    catch { setUnavailable(true) }
  }
  return { units, applyUnits, storageUnavailable }
}
