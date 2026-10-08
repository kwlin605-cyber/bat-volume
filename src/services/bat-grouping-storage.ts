import { batGroupingStorage } from '../config/grouping'
import { isBatGroupingSettings, normalizeBatGrouping, type BatGroupingSettings } from '../domain/bat-grouping'
import type { SettingsStorage } from './settings-storage'

export function readBatGrouping(storage: SettingsStorage) {
  try {
    const raw = storage.getItem(batGroupingStorage.key)
    const data = raw ? JSON.parse(raw) : null
    return { settings: normalizeBatGrouping(data?.version === batGroupingStorage.version ? data.settings : null), unavailable: false }
  } catch { return { settings: normalizeBatGrouping(null), unavailable: true } }
}

export function saveBatGrouping(storage: SettingsStorage, settings: BatGroupingSettings) {
  if (!isBatGroupingSettings(settings)) return false
  try {
    storage.setItem(batGroupingStorage.key, JSON.stringify({ version: batGroupingStorage.version, settings }))
    return true
  } catch { return false }
}
