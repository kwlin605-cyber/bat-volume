import { massPropertyUnitStorageKey } from '../config/mass-properties'
import { normalizeMassPropertyUnits, type MassPropertyUnits } from '../domain/mass-property-units'
import type { SettingsStorage } from './settings-storage'

export function readMassPropertyUnits(storage: SettingsStorage) {
  try {
    const saved = storage.getItem(massPropertyUnitStorageKey)
    return { units: normalizeMassPropertyUnits(saved === null ? null : JSON.parse(saved)), unavailable: false }
  } catch { return { units: normalizeMassPropertyUnits(null), unavailable: true } }
}
export function saveMassPropertyUnits(storage: SettingsStorage, units: MassPropertyUnits) {
  try { storage.setItem(massPropertyUnitStorageKey, JSON.stringify(units)); return true }
  catch { return false }
}
