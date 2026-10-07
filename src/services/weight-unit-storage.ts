import { isWeightDisplayMode, type WeightDisplayMode } from '../domain/weight-unit'
import type { SettingsStorage } from './material-storage'

export const weightUnitStorageKey = 'bat-volume.weight-unit'
export function readWeightUnit(storage: SettingsStorage) {
  try {
    const mode = storage.getItem(weightUnitStorageKey)
    return { mode: isWeightDisplayMode(mode) ? mode : 'g' as WeightDisplayMode, unavailable: false }
  } catch { return { mode: 'g' as WeightDisplayMode, unavailable: true } }
}
export function saveWeightUnit(storage: SettingsStorage, mode: WeightDisplayMode) {
  try { storage.setItem(weightUnitStorageKey, mode); return true }
  catch { return false }
}
