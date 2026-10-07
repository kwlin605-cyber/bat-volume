import type { MaterialSettings } from '../domain/weight'

export const initialMaterialSettings: MaterialSettings = { referenceDensity: 0.7, volumeCm3: null, weightG: null }
export const materialStorage = { key: 'bat-volume.material', version: 1 } as const
