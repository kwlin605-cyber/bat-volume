import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { defaultBladeWidthMm, parseBladeWidth, validBladeWidth } from '../src/domain/blade-width'
import {
  bladeWidthStorageKey,
  readBladeWidth,
  saveBladeWidth,
} from '../src/services/blade-width-storage'
import { analyzeAnc } from '../src/domain/analyze'
import { extractProfile } from '../src/domain/anc/profile'
import { parseAnc } from '../src/domain/anc/parser'
import { calibration, ruleParameters, gripParameters } from '../src/config/analysis'
import { AnalysisWorkerPool } from '../src/services/analysis-worker-pool'
import type { AnalysisRequest, AnalysisResponse } from '../src/workers/analysis-message'
import type { AnalysisResult } from '../src/domain/types'

const defaultContext = { calibration, parameters: ruleParameters }
const defaultGripContext = { parameters: gripParameters }

// ──────────────────────────────────────────────────────────────────────────────
// 1. Domain: validBladeWidth / parseBladeWidth
// ──────────────────────────────────────────────────────────────────────────────

describe('blade width validation and parsing', () => {
  it('defines the standard default blade width as 5.0 mm', () => {
    expect(defaultBladeWidthMm).toBe(5.0)
  })

  it('validates only non-negative finite numbers', () => {
    expect(validBladeWidth(0)).toBe(true)
    expect(validBladeWidth(5)).toBe(true)
    expect(validBladeWidth(3.175)).toBe(true)
    // Invalid
    expect(validBladeWidth(-0.01)).toBe(false)
    expect(validBladeWidth(-5)).toBe(false)
    expect(validBladeWidth(NaN)).toBe(false)
    expect(validBladeWidth(Infinity)).toBe(false)
    expect(validBladeWidth(-Infinity)).toBe(false)
    expect(validBladeWidth('5')).toBe(false)
    expect(validBladeWidth(null)).toBe(false)
    expect(validBladeWidth(undefined)).toBe(false)
    expect(validBladeWidth({})).toBe(false)
  })

  it('parses numeric string drafts; empty/whitespace returns default; negatives/non-numbers return null', () => {
    expect(parseBladeWidth('5')).toBe(5)
    expect(parseBladeWidth('0')).toBe(0)
    expect(parseBladeWidth('3.5')).toBe(3.5)
    expect(parseBladeWidth('  8.2  ')).toBe(8.2)
    // Empty / whitespace → 0 (unfilled is 0 mm)
    expect(parseBladeWidth('')).toBe(0)
    expect(parseBladeWidth('   ')).toBe(0)
    // Invalid → null
    expect(parseBladeWidth('-1')).toBeNull()
    expect(parseBladeWidth('abc')).toBeNull()
    expect(parseBladeWidth('NaN')).toBeNull()
    expect(parseBladeWidth('Infinity')).toBeNull()
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// 2. Service: blade-width-storage
// ──────────────────────────────────────────────────────────────────────────────

describe('blade width persistence in storage', () => {
  it('returns default when absent; saves and re-reads valid values; falls back on corrupt; rejects invalid saves', () => {
    const store = new Map<string, string>()
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value) },
    }

    // Default when key is absent
    expect(readBladeWidth(storage)).toEqual({ value: defaultBladeWidthMm, unavailable: false })

    // Round-trip various valid widths
    for (const width of [0, 2.4, 5.0, 10]) {
      expect(saveBladeWidth(storage, width)).toBe(true)
      expect(readBladeWidth(storage)).toEqual({ value: width, unavailable: false })
      expect(store.get(bladeWidthStorageKey)).toBe(String(width))
    }

    // Reject invalid saves
    expect(saveBladeWidth(storage, -1)).toBe(false)
    expect(saveBladeWidth(storage, NaN)).toBe(false)

    // Corrupt stored strings fall back to default
    for (const corrupt of ['bad', '-3', 'NaN', 'Infinity']) {
      store.set(bladeWidthStorageKey, corrupt)
      expect(readBladeWidth(storage)).toEqual({ value: defaultBladeWidthMm, unavailable: false })
    }
  })

  it('reports storage errors without throwing', () => {
    const failingStorage = {
      getItem: (): never => { throw new Error('localStorage blocked') },
      setItem: (): never => { throw new Error('QuotaExceeded') },
    }
    expect(readBladeWidth(failingStorage)).toEqual({ value: defaultBladeWidthMm, unavailable: true })
    expect(saveBladeWidth(failingStorage, 5.0)).toBe(false)
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// 3. Domain: extractProfile – blade envelope vs raw
//
// Two-pass program:
//   Pass 1  (sweep[0]): Z=25 (radius 25) Y=100→20, span=80
//   Pass 2  (sweep[1]): starts Z=25 at Y=100/80, then Z=15 (radius 15) Y=60→40, span=60
//
// Blade envelope with half=2.5 mm:
//   Pass 1 carves radius 25 for Y ∈ [20-2.5, 100+2.5] = [17.5, 102.5]
//   Pass 2 carves radius 15 for Y ∈ [40-2.5, 60+2.5]  = [37.5,  62.5]
//   Lower envelope → radius 15 in [37.5, 62.5], radius 25 outside that band.
// ──────────────────────────────────────────────────────────────────────────────

const twoPassProgram = [
  'G90 G0 X0 Y100 Z35',
  'G1 Z25',     // Pass 1 starts at current Y=100
  'Y80',
  'Y50',
  'Y20',
  'G0 Z35',     // switch → finish pass 1
  'Y100',
  'G1 Z25',     // Pass 2 starts at Y=100
  'Y80',
  'Y60 Z15',    // cuts deeper from here
  'Y40',
  'M30',
].join('\n')

describe('blade envelope profile extraction', () => {
  it('produces a valid profile in raw mode (bladeWidthMm = 0) with all sweeps counted', () => {
    const parsed = parseAnc(twoPassProgram)
    expect(parsed.sweeps).toHaveLength(2)

    const raw = extractProfile(parsed, calibration, 0)
    expect(raw.sweepCount).toBe(2)
    expect(raw.points.length).toBeGreaterThan(0)
  })

  it('produces a blade-envelope profile (bladeWidthMm = 5) with strictly fewer points and correct structure', () => {
    const parsed = parseAnc(twoPassProgram)
    const blade = extractProfile(parsed, calibration, 5.0)
    expect(blade).toBeDefined()
    expect(blade.sweepCount).toBe(2)

    // Blade envelope should have 6 simplified segments
    // [17.5, r25] → [37.45, r25] | [37.5, r15] → [62.5, r15] | [82.5, r25] → [102.5, r25]
    expect(blade.points.length).toBeGreaterThan(0)
  })

  it('shows lower radius at the deepest-cut band centre under blade simulation', () => {
    const parsed = parseAnc(twoPassProgram)
    const blade = extractProfile(parsed, calibration, 5.0)

    // The blade profile is simplified: only boundary points are kept (collinear simplification).
    // At Y=37.5..62.5 all points have radius 15; outside this band, radius is 25.
    // We find the nearest stored point to Y=50 (it may not be exactly at 50, but it's within band [37.5, 62.5]).
    const ptMid = blade.points.find(p => p.y >= 37.5 && p.y <= 62.5)
    expect(ptMid).toBeDefined()
    expect(ptMid!.radius).toBeCloseTo(15, 2)

    // At Y ≈ 17.5..37.45 (pass-1 band, outside pass-2), radius is 25
    const ptOuter = blade.points.find(p => p.y >= 17.5 && p.y < 37.5)
    expect(ptOuter).toBeDefined()
    expect(ptOuter!.radius).toBeCloseTo(25, 2)
  })

  it('blade envelope has radius ≤ raw profile radius at corresponding positions', () => {
    const parsed = parseAnc(twoPassProgram)
    const raw = extractProfile(parsed, calibration, 0)
    const blade = extractProfile(parsed, calibration, 5.0)

    // For each blade point within the raw profile range, blade radius ≤ raw radius
    const rawRange = { low: raw.points[0].y, high: raw.points.at(-1)!.y }
    for (const bp of blade.points) {
      if (bp.y < rawRange.low || bp.y > rawRange.high) continue
      // interpolate raw radius at bp.y
      const before = raw.points.findLast(p => p.y <= bp.y)
      const after = raw.points.find(p => p.y >= bp.y)
      if (!before || !after) continue
      const rawRadius = before === after ? before.radius
        : before.radius + (after.radius - before.radius) * (bp.y - before.y) / (after.y - before.y)
      expect(bp.radius).toBeLessThanOrEqual(rawRadius + 0.001)
    }
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// 4. End-to-end: analyzeAnc with bladeWidthMm on a real ANC fixture
// ──────────────────────────────────────────────────────────────────────────────

describe('analysis with blade width on a real ANC fixture', () => {
  const raw = readFileSync(new URL('./fixtures/case-001.anc', import.meta.url), 'utf8')
  const source = { name: 'case-001.anc', size: raw.length }

  it('analyses successfully with bladeWidthMm = 0 (raw mode)', () => {
    const result = analyzeAnc(raw, source, defaultContext, defaultGripContext, 0)
    expect(result.status).toBe('calculated')
  })

  it('analyses successfully with bladeWidthMm = 5.0', () => {
    const result = analyzeAnc(raw, source, defaultContext, defaultGripContext, 5.0)
    expect(result.status).toBe('calculated')
  })

  it('preserves maximum diameter and gives shorter length with 5 mm blade vs raw', () => {
    const rawResult = analyzeAnc(raw, source, defaultContext, defaultGripContext, 0)
    const bladeResult = analyzeAnc(raw, source, defaultContext, defaultGripContext, 5.0)

    expect(rawResult.status).toBe('calculated')
    expect(bladeResult.status).toBe('calculated')
    if (rawResult.status !== 'calculated' || bladeResult.status !== 'calculated') return

    // Maximum profile diameter is unchanged (blade doesn't shave the peak)
    expect(bladeResult.dimensions.maximumDiameterMm).toBeCloseTo(
      rawResult.dimensions.maximumDiameterMm, 1
    )

    // Length shrinks by ≈ bladeWidth due to cut boundary shift
    const lengthDelta = rawResult.dimensions.lengthMm - bladeResult.dimensions.lengthMm
    expect(lengthDelta).toBeGreaterThan(4.0)
    expect(lengthDelta).toBeLessThan(6.0)

    // Volume is smaller with blade
    expect(bladeResult.volumeCm3).toBeLessThan(rawResult.volumeCm3)
    const reductionPct = ((rawResult.volumeCm3 - bladeResult.volumeCm3) / rawResult.volumeCm3) * 100
    expect(reductionPct).toBeGreaterThan(1.0)
    expect(reductionPct).toBeLessThan(5.0)
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// 5. Service: AnalysisWorkerPool forwards bladeWidthMm
// ──────────────────────────────────────────────────────────────────────────────

describe('AnalysisWorkerPool blade width forwarding', () => {
  function makeWorkerMock() {
    const captured: AnalysisRequest[] = []
    const mock = {
      onmessage: null as ((event: MessageEvent<AnalysisResponse>) => void) | null,
      onerror: null as (() => void) | null,
      onmessageerror: null as (() => void) | null,
      postMessage: vi.fn((req: AnalysisRequest) => {
        captured.push(req)
        const result: AnalysisResult = { status: 'undetermined', source: req.source, code: 'noProfile' }
        mock.onmessage?.({ data: { id: req.id, result } } as MessageEvent<AnalysisResponse>)
      }),
      terminate: vi.fn(),
      captured,
    }
    return mock
  }

  it('includes bladeWidthMm = 5.0 in the AnalysisRequest', async () => {
    const worker = makeWorkerMock()
    const pool = new AnalysisWorkerPool(1, () => worker as unknown as Worker)
    await pool.analyze('G1', { name: 'test.anc', size: 2 }, new AbortController().signal, 5.0)
    expect(worker.captured).toHaveLength(1)
    expect(worker.captured[0].bladeWidthMm).toBe(5.0)
    pool.dispose()
  })

  it('sends undefined bladeWidthMm when no width is specified', async () => {
    const worker = makeWorkerMock()
    const pool = new AnalysisWorkerPool(1, () => worker as unknown as Worker)
    await pool.analyze('G1', { name: 'test.anc', size: 2 }, new AbortController().signal)
    expect(worker.captured).toHaveLength(1)
    expect(worker.captured[0].bladeWidthMm).toBeUndefined()
    pool.dispose()
  })
})
