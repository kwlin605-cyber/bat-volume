import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { analyzeAnc } from '../src/domain/analyze'
import corpus from './fixtures/corpus.json'
import dimensions from './fixtures/dimensions.json'

describe('43 supplied ANC programs: program-boundary regression, not physical cut validation', () => {
  for (const entry of corpus) {
    it(entry.name, () => {
      const raw = readFileSync(new URL(`./fixtures/${entry.file}`, import.meta.url), 'utf8')
      const result = analyzeAnc(raw, { name: entry.name, size: Buffer.byteLength(raw) })
      if (entry.cuts) {
        expect(result.status).toBe('calculated')
        if (result.status !== 'calculated') return
        expect(result.cuts.low).toBeCloseTo(entry.cuts[0], 6)
        expect(result.cuts.high).toBeCloseTo(entry.cuts[1], 6)
        expect(result.volumeCm3).toBeGreaterThan(0)
        expect(result.retained[0].y).toBe(result.cuts.low)
        expect(result.retained.at(-1)!.y).toBe(result.cuts.high)
        const expected = dimensions.find(sample => sample.file === entry.file)!
        expect(result.dimensions.lengthMm).toBeCloseTo(expected.lengthMm, 7)
        expect(result.dimensions.maximumDiameterMm).toBeCloseTo(expected.maximumDiameterMm, 7)
        expect(result.dimensions.grip.status).toBe('detected')
        if (result.dimensions.grip.status !== 'detected') return
        expect(result.dimensions.grip.diameterMm).toBeCloseTo(expected.minimumGripDiameterMm, 7)
        expect(result.dimensions.grip.end).toBe('high')
      } else {
        expect(result).toMatchObject({ status: 'undetermined', code: 'missingHighEnd' })
        expect('volumeMm3' in result).toBe(false)
      }
    })
  }
})
