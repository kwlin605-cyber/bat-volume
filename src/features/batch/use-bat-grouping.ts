import { useState } from 'react'
import { isBatGroupingSettings, normalizeBatGrouping, type BatGroupingSettings } from '../../domain/bat-grouping'
import { readBatGrouping, saveBatGrouping } from '../../services/bat-grouping-storage'

/** Grouping survives file-list resets, just like material and unit preferences. */
export function useBatGrouping() {
  const [loaded] = useState(() => {
    try { return readBatGrouping(window.localStorage) }
    catch { return { settings: normalizeBatGrouping(null), unavailable: true } }
  })
  const [grouping, setGrouping] = useState(loaded.settings)
  const [storageUnavailable, setStorageUnavailable] = useState(loaded.unavailable)
  function applyGrouping(next: BatGroupingSettings) {
    if (!isBatGroupingSettings(next)) return
    setGrouping(next)
    try { setStorageUnavailable(!saveBatGrouping(window.localStorage, next)) }
    catch { setStorageUnavailable(true) }
  }
  return { grouping, applyGrouping, storageUnavailable }
}
