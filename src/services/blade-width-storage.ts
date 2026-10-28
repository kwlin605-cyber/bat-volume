import { defaultBladeWidthMm, parseBladeWidth, validBladeWidth } from '../domain/blade-width'
import type { SettingsStorage } from './settings-storage'

export const bladeWidthStorageKey = 'bat-volume.blade-width-mm'

export function readBladeWidth(storage: SettingsStorage) {
  try {
    const saved = storage.getItem(bladeWidthStorageKey)
    return {
      value: saved === null ? defaultBladeWidthMm : parseBladeWidth(saved) ?? defaultBladeWidthMm,
      unavailable: false,
    }
  } catch {
    return { value: defaultBladeWidthMm, unavailable: true }
  }
}

export function saveBladeWidth(storage: SettingsStorage, value: number): boolean {
  if (!validBladeWidth(value)) return false
  try {
    storage.setItem(bladeWidthStorageKey, String(value))
    return true
  } catch {
    return false
  }
}
