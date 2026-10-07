import { initialMaterialSettings, materialStorage } from '../config/weight'
import { positiveFinite, validWeightError, type MaterialSettings } from '../domain/weight'

export interface SettingsStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export function isMaterialSettings(value: unknown): value is MaterialSettings {
  if (!value || typeof value !== 'object') return false
  const input = value as Partial<MaterialSettings>
  return positiveFinite(input.referenceDensity) && (input.volumeCm3 === null || positiveFinite(input.volumeCm3))
    && (input.weightG === null || positiveFinite(input.weightG)) && validWeightError(input.weightErrorPercent)
}
export function readMaterialSettings(storage: SettingsStorage) {
  try {
    const raw = storage.getItem(materialStorage.key)
    if (!raw) return { settings: { ...initialMaterialSettings }, unavailable: false }
    const data = JSON.parse(raw)
    const settings = data?.version === 1 ? { ...data.settings, weightErrorPercent: 0 } : data?.settings
    const supported = data?.version === 1 || data?.version === materialStorage.version
    return { settings: supported && isMaterialSettings(settings) ? settings : { ...initialMaterialSettings }, unavailable: false }
  } catch { return { settings: { ...initialMaterialSettings }, unavailable: true } }
}
export function saveMaterialSettings(storage: SettingsStorage, settings: MaterialSettings) {
  if (!isMaterialSettings(settings)) return false
  try {
    const { referenceDensity, volumeCm3, weightG, weightErrorPercent } = settings
    storage.setItem(materialStorage.key, JSON.stringify({ version: materialStorage.version, settings: { referenceDensity, volumeCm3, weightG, weightErrorPercent } })); return true
  }
  catch { return false }
}
