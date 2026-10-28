import type { MaterialSettings } from '../domain/weight'

export const initialMaterialSettings: MaterialSettings = { referenceDensity: null, volumeCm3: 3725.6, weightG: null, weightErrorPercent: 0 }
export const materialStorage = { key: 'bat-volume.material', version: 3 } as const
