import { describe, expect, it } from 'vitest'
import { calculateMaterialWeight, estimateBatWeight, materialDensity, type MaterialSettings } from '../src/domain/weight'
import { initialMaterialSettings, materialStorage } from '../src/config/weight'
import { readMaterialSettings, saveMaterialSettings, type SettingsStorage } from '../src/services/material-storage'
import { parseRequirement } from '../src/features/batch/weight-input'

const material: MaterialSettings = { referenceDensity: 0.7, volumeCm3: 3000, weightG: null, weightErrorPercent: 0 }
describe('estimated bat weight', () => {
  it('works without material volume or weight, and reflects the adjustable reference density', () => {
    expect(estimateBatWeight(initialMaterialSettings, 1000)).toBeNull()
    expect(estimateBatWeight({ ...initialMaterialSettings, referenceDensity: 0.8 }, 1000)).toBe(800)
    expect(estimateBatWeight({ ...initialMaterialSettings, weightG: 1800 }, 1000)).toBeNull()
  })
  it('uses actual density only when both material measurements are present', () => {
    expect(estimateBatWeight(material, 1000)).toBe(700)
    expect(estimateBatWeight({ ...material, weightG: 1800 }, 1000)).toBe(600)
  })
  it('preserves precision and handles missing or invalid geometry without inventing a weight', () => {
    expect(estimateBatWeight(material, 1129.9491175359196)).toBe(1129.9491175359196 * 0.7)
    expect(estimateBatWeight(initialMaterialSettings, null)).toBeNull()
    expect(estimateBatWeight(initialMaterialSettings, -1)).toBeNull()
    expect(estimateBatWeight({ ...material, referenceDensity: 2 }, Number.MAX_VALUE)).toBeNull()
  })
})
describe('material weight calculations', () => {
  it('uses reference density until both material measurements are supplied', () => {
    expect(materialDensity(initialMaterialSettings)).toBeNull()
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
  it.each([-3, 0, 5])('reverses a measured error of %s percent to meet the original target', error => {
    const target = { min: 600.123, max: 650.789 }
    const value = calculateMaterialWeight({ ...material, weightErrorPercent: error }, 1000, target)
    if (value.kind !== 'recommended') throw new Error('Expected range')
    const factor = 1 + error / 100
    expect(value.range.min).toBeCloseTo(600.123 * 3 / factor, 10)
    expect(value.range.max).toBeCloseTo(650.789 * 3 / factor, 10)
    expect(value.range.min * (1000 / 3000) * factor).toBeCloseTo(target.min, 10)
    expect(value.range.max * (1000 / 3000) * factor).toBeCloseTo(target.max, 10)
    expect(target).toEqual({ min: 600.123, max: 650.789 })
  })
  it('corrects estimates and equal targets in opposite directions without changing actual raw measurements', () => {
    const settings = { ...material, weightG: 1800, weightErrorPercent: -3 }
    expect(materialDensity(settings)).toBe(0.6)
    expect(estimateBatWeight(settings, 1000)).toBe(582)
    expect(calculateMaterialWeight(settings, 1000, null)).toEqual({ kind: 'reference', weightG: 1800 })
    expect(calculateMaterialWeight(settings, 1000, { min: 800, max: 800 })).toEqual({ kind: 'recommended', range: { min: 800 * (3 / 0.97), max: 800 * (3 / 0.97) } })
  })
  it('treats blank correction as zero, requires density only for estimates, and allows targets without density', () => {
    expect(estimateBatWeight({ ...material, weightErrorPercent: null }, 1000)).toBe(700)
    expect(estimateBatWeight({ ...material, weightErrorPercent: 5 }, 1000)).toBe(735)
    const noDensity = { ...initialMaterialSettings, volumeCm3: 3000 }
    expect(calculateMaterialWeight(noDensity, 1000, null)).toEqual({ kind: 'unavailable', reason: 'invalidWeight' })
    expect(calculateMaterialWeight(noDensity, 1000, { min: 800, max: 850 })).toEqual({ kind: 'recommended', range: { min: 2400, max: 2550 } })
    expect(estimateBatWeight({ ...noDensity, weightG: 2400, weightErrorPercent: -3 }, 1000)).toBe(776)
    expect(estimateBatWeight({ ...material, weightErrorPercent: -100 }, 1000)).toBeNull()
  })
  it.each([-100, -101, NaN, Infinity])('rejects an unusable error %s instead of producing invalid weight', error => {
    expect(calculateMaterialWeight({ ...material, weightErrorPercent: error }, 1000, { min: 600, max: 650 })).toEqual({ kind: 'unavailable', reason: 'invalidWeight' })
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
  it('starts all four fields blank and round-trips optional measurements', () => {
    const storage = memory()
    expect(readMaterialSettings(storage)).toEqual({ settings: initialMaterialSettings, unavailable: false })
    expect(initialMaterialSettings).toEqual({ referenceDensity: null, volumeCm3: null, weightG: null, weightErrorPercent: null })
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
  it('preserves old material measurements and starts their new correction at zero', () => {
    const old = { referenceDensity: 0.82, volumeCm3: 2800, weightG: 2100 }
    const storage = memory(JSON.stringify({ version: 1, settings: old }))
    expect(readMaterialSettings(storage).settings).toEqual({ ...old, weightErrorPercent: null })
    const updated = { ...readMaterialSettings(storage).settings, weightErrorPercent: -3 }
    expect(saveMaterialSettings(storage, updated)).toBe(true)
    expect(readMaterialSettings(storage).settings).toEqual(updated)
    expect(JSON.parse(storage.getItem(materialStorage.key)!).version).toBe(3)
  })
  it('preserves previously saved settings and keeps cleared fields blank after reopening', () => {
    const storage = memory(JSON.stringify({ version: 2, settings: material }))
    expect(readMaterialSettings(storage).settings).toEqual(material)
    expect(saveMaterialSettings(storage, initialMaterialSettings)).toBe(true)
    expect(readMaterialSettings(storage).settings).toEqual(initialMaterialSettings)
  })
  it('does not store invalid correction values or discard valid negative and decimal percentages', () => {
    const storage = memory()
    expect(saveMaterialSettings(storage, { ...material, weightErrorPercent: -100 })).toBe(false)
    expect(saveMaterialSettings(storage, { ...material, weightErrorPercent: -3.25 })).toBe(true)
    expect(readMaterialSettings(storage).settings.weightErrorPercent).toBe(-3.25)
    expect(readMaterialSettings(memory(JSON.stringify({ version: 2, settings: { ...material, weightErrorPercent: -100 } }))).settings).toEqual(initialMaterialSettings)
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
