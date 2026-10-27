import { defaultDiameterAllowanceMm, parseDiameterAllowance, validDiameterAllowance } from '../domain/diameter-allowance'
import type { SettingsStorage } from './settings-storage'

export const diameterAllowanceStorageKey = 'bat-volume.diameter-allowance-mm'
export function readDiameterAllowance(storage: SettingsStorage) {
  try {
    const saved = storage.getItem(diameterAllowanceStorageKey)
    return { value: saved === null ? defaultDiameterAllowanceMm : parseDiameterAllowance(saved) ?? defaultDiameterAllowanceMm, unavailable: false }
  } catch { return { value: defaultDiameterAllowanceMm, unavailable: true } }
}
export function saveDiameterAllowance(storage: SettingsStorage, value: number): boolean {
  if (!validDiameterAllowance(value)) return false
  try { storage.setItem(diameterAllowanceStorageKey, String(value)); return true }
  catch { return false }
}
