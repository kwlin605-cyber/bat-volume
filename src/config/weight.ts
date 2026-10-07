import type { MaterialSettings } from '../domain/weight'

export const initialMaterialSettings: MaterialSettings = { referenceDensity: null, volumeCm3: null, weightG: null, weightErrorPercent: null }
export const materialStorage = { key: 'bat-volume.material', version: 3 } as const
