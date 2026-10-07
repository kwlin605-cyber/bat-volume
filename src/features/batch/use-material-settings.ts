import { useState } from 'react'
import { initialMaterialSettings } from '../../config/weight'
import type { MaterialSettings } from '../../domain/weight'
import { readMaterialSettings, saveMaterialSettings } from '../../services/material-storage'

export function useMaterialSettings() {
  const [loaded] = useState(() => {
    try { return readMaterialSettings(window.localStorage) }
    catch { return { settings: { ...initialMaterialSettings }, unavailable: true } }
  })
  const [material, setMaterial] = useState<MaterialSettings>(loaded.settings)
  const [storageUnavailable, setStorageUnavailable] = useState(loaded.unavailable)
  function applyMaterial(settings: MaterialSettings) {
    setMaterial(settings)
    try { setStorageUnavailable(!saveMaterialSettings(window.localStorage, settings)) }
    catch { setStorageUnavailable(true) }
  }
  return { material, applyMaterial, storageUnavailable }
}
