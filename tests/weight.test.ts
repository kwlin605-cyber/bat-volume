import { describe, expect, it } from 'vitest'
import { calculateMaterialWeight, estimateBatWeight, materialDensity, type MaterialSettings } from '../src/domain/weight'
import { initialMaterialSettings, materialStorage } from '../src/config/weight'
import { readMaterialSettings, saveMaterialSettings, type SettingsStorage } from '../src/services/material-storage'
import { parseRequirement } from '../src/features/batch/weight-input'

const material: MaterialSettings = { referenceDensity: 0.7, volumeCm3: 3000, weightG: null }
describe('estimated bat weight', () => {
  it('works without material volume or weight, and reflects the adjustable reference density', () => {
    expect(estimateBatWeight(initialMaterialSettings, 1000)).toBe(700)
    expect(estimateBatWeight({ ...initialMaterialSettings, referenceDensity: 0.8 }, 1000)).toBe(800)
    expect(estimateBatWeight({ ...initialMaterialSettings, weightG: 1800 }, 1000)).toBe(700)
  })
  it('uses actual density only when both material measurements are present', () => {
    expect(estimateBatWeight(material, 1000)).toBe(700)
    expect(estimateBatWeight({ ...material, weightG: 1800 }, 1000)).toBe(600)
  })
  it('preserves precision and handles missing or invalid geometry without inventing a weight', () => {
    expect(estimateBatWeight(initialMaterialSettings, 1129.9491175359196)).toBe(1129.9491175359196 * 0.7)
    expect(estimateBatWeight(initialMaterialSettings, null)).toBeNull()
    expect(estimateBatWeight(initialMaterialSettings, -1)).toBeNull()
    expect(estimateBatWeight({ ...material, referenceDensity: 2 }, Number.MAX_VALUE)).toBeNull()
  })
})
describe('material weight calculations', () => {
  it('uses reference density until both material measurements are supplied', () => {
    expect(materialDensity(initialMaterialSettings)).toBe(0.7)
    expect(materialDensity(material)).toBe(0.7)
    expect(materialDensity({ ...material, volumeCm3: null, weightG: 1800 })).toBe(0.7)
    expect(materialDensity({ ...material, weightG: 1800 })).toBe(0.6)
    expect(calculateMaterialWeight(material, null, null)).toEqual({ kind: 'reference', weightG: 2100 })
    expect(calculateMaterialWeight({ ...material, weightG: 1800 }, 1000, null)).toEqual({ kind: 'reference', weightG: 1800 })
    expect(calculateMaterialWeight({ ...material, referenceDensity: 0.8 }, 1000, null)).toEqual({ kind: 'reference', weightG: 2400 })
  })
  it('derives a range from retained bat volume, independently of current material density', () => {
    const target = { min: 600, max: 650 }
    const expected = { kind: 'recommended', range: { min: 1800, max: 1950 } }
    expect(calculateMaterialWeight(material, 1000, target)).toEqual(expected)
    expect(calculateMaterialWeight({ ...material, referenceDensity: 0.9, weightG: 2500 }, 1000, target)).toEqual(expected)
    expect(calculateMaterialWeight(material, 3000, { min: 650, max: 650 })).toEqual({ kind: 'recommended', range: { min: 650, max: 650 } })
  })
  it('retains precision and rejects arithmetic overflow', () => {
    const value = calculateMaterialWeight(material, 1129.9491175359196, { min: 600.123, max: 650.789 })
    if (value.kind !== 'recommended') throw new Error('Expected range')
    expect(value.range.min).toBe(600.123 * (3000 / 1129.9491175359196))
    expect(value.range.max).toBe(650.789 * (3000 / 1129.9491175359196))
    expect(calculateMaterialWeight({ ...material, volumeCm3: Number.MAX_VALUE }, 1, { min: 600, max: 650 })).toEqual({ kind: 'unavailable', reason: 'invalidWeight' })
    expect(calculateMaterialWeight({ ...material, volumeCm3: Number.MAX_VALUE, referenceDensity: 2 }, null, null)).toEqual({ kind: 'unavailable', reason: 'invalidWeight' })
  })
  it('does not invent volume or recommend material smaller than the retained bat', () => {
    const target = { min: 600, max: 650 }
    expect(calculateMaterialWeight({ ...material, volumeCm3: null, weightG: 1800 }, 1000, target)).toEqual({ kind: 'unavailable', reason: 'missingMaterialVolume' })
    expect(calculateMaterialWeight(material, null, target)).toEqual({ kind: 'unavailable', reason: 'missingBatVolume' })
    expect(calculateMaterialWeight(material, 3100, target)).toEqual({ kind: 'unavailable', reason: 'materialTooSmall' })
    expect(calculateMaterialWeight(material, 1000, { min: 700, max: 600 })).toEqual({ kind: 'unavailable', reason: 'invalidWeight' })
  })
})

describe('requirement draft validation', () => {
  it('allows equal limits, decimals and explicit clearing', () => {
    expect(parseRequirement('600.12', '650.789')).toEqual({ range: { min: 600.12, max: 650.789 } })
    expect(parseRequirement('650', '650')).toEqual({ range: { min: 650, max: 650 } })
    expect(parseRequirement('', ' ')).toEqual({ range: null })
  })
  it.each([['', '650'], ['600', ''], ['0', '650'], ['-1', '650'], ['Infinity', '700'], ['NaN', '700']])('rejects incomplete or nonpositive input %s / %s', (min, max) => {
    expect(parseRequirement(min, max).error).toBe('positive')
  })
  it('rejects reversed limits', () => { expect(parseRequirement('650', '600').error).toBe('range') })
})

describe('versioned local material storage', () => {
  function memory(raw: string | null = null): SettingsStorage {
    const values = new Map<string, string>(raw === null ? [] : [[materialStorage.key, raw]])
    return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) } }
  }
  it('defaults to empty material dimensions and density 0.7, and round-trips optional measurements', () => {
    const storage = memory()
    expect(readMaterialSettings(storage)).toEqual({ settings: initialMaterialSettings, unavailable: false })
    for (const settings of [material, { ...material, volumeCm3: null, weightG: 1800 }, { ...material, referenceDensity: 0.75, weightG: 1800 }]) {
      expect(saveMaterialSettings(storage, settings)).toBe(true)
      expect(readMaterialSettings(storage)).toEqual({ settings, unavailable: false })
    }
  })
  it('serializes only material settings, without per-file requirements or other fields', () => {
    const storage = memory()
    saveMaterialSettings(storage, { ...material, requirements: { private: { min: 600, max: 650 } } } as MaterialSettings)
    expect(JSON.parse(storage.getItem(materialStorage.key)!)).toEqual({ version: materialStorage.version, settings: material })
  })
  it('handles corrupt data, unsupported versions and invalid values safely', () => {
    expect(readMaterialSettings(memory('{')).settings).toEqual(initialMaterialSettings)
    for (const data of [{ version: 999, settings: material }, { version: 1, settings: { ...material, referenceDensity: 0 } }, { version: 1, settings: { ...material, volumeCm3: -1 } }]) {
      expect(readMaterialSettings(memory(JSON.stringify(data))).settings).toEqual(initialMaterialSettings)
    }
  })
  it('keeps calculations usable when browser storage is blocked', () => {
    const blocked = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } }
    expect(readMaterialSettings(blocked)).toEqual({ settings: initialMaterialSettings, unavailable: true })
    expect(saveMaterialSettings(blocked, material)).toBe(false)
  })
})
