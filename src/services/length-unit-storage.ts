import { isLengthDisplayMode, type LengthDisplayMode } from '../domain/length-unit'
import type { SettingsStorage } from './settings-storage'

export const lengthUnitStorageKey = 'bat-volume.length-unit'
export function readLengthUnit(storage: SettingsStorage) {
  try {
    const mode = storage.getItem(lengthUnitStorageKey)
    return { mode: isLengthDisplayMode(mode) ? mode : 'mm' as LengthDisplayMode, unavailable: false }
  } catch { return { mode: 'mm' as LengthDisplayMode, unavailable: true } }
}
export function saveLengthUnit(storage: SettingsStorage, mode: LengthDisplayMode) {
  try { storage.setItem(lengthUnitStorageKey, mode); return true }
  catch { return false }
}
