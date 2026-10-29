import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { analyzeAnc } from '../src/domain/analyze'
import { parseAnc } from '../src/domain/anc/parser'
import { profilePointAt } from '../src/domain/geometry/profile'
import { clipProfile, integrateVolumeMm3 } from '../src/domain/geometry/volume'
import { detectCuts } from '../src/domain/cuts/registry'
import { calibration, ruleParameters } from '../src/config/analysis'
import type { Program } from '../src/domain/types'

const root = fileURLToPath(new URL('../src/assets/anc', import.meta.url))
function ancFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? ancFiles(join(directory, entry.name))
    : entry.name.toLowerCase().endsWith('.anc') ? [join(directory, entry.name)] : [])
}

// Independent point query against the original moving blade, without building an envelope.
function directCutRadius(program: Program, y: number, halfWidth: number): number {
  let radius = Infinity
  for (const sweep of program.sweeps) {
    for (let i = 1; i < sweep.points.length; i++) {
      const a = sweep.points[i - 1], b = sweep.points[i]
      if (a.y === b.y) {
        if (Math.abs(y - a.y) <= halfWidth) radius = Math.min(radius, a.z, b.z)
        continue
      }
      const t0 = (y - halfWidth - a.y) / (b.y - a.y), t1 = (y + halfWidth - a.y) / (b.y - a.y)
      const enter = Math.max(0, Math.min(t0, t1)), leave = Math.min(1, Math.max(t0, t1))
      if (enter <= leave) radius = Math.min(radius, a.z + (b.z - a.z) * enter, a.z + (b.z - a.z) * leave)
    }
  }
  return radius
}

describe('5 mm full geometry across the entire built-in ANC library', () => {
  for (const file of ancFiles(root).sort()) {
    it(relative(root, file), () => {
      const bytes = readFileSync(file)
      let text: string
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
      catch { text = new TextDecoder('big5').decode(bytes) }
      const program = parseAnc(text)
      const result = analyzeAnc(text, { name: relative(root, file), size: bytes.length }, undefined, undefined, 5)
      if (!program.sweeps.length) {
        expect(result).toMatchObject({ status: 'undetermined', code: 'noProfile' })
        return
      }
      expect(result.status).toBe('calculated')
      if (result.status !== 'calculated') throw new Error(`Unexpected analysis failure: ${result.code}`)
      // Probe off-grid positions to catch missing corners and incorrect envelope merges.
      for (let i = 0; i < 31; i++) {
        const y = result.profile.range.low + (result.profile.range.high - result.profile.range.low) * (i + 0.371) / 31
        expect(profilePointAt(result.profile.points, y).radius).toBeCloseTo(directCutRadius(program, y, 2.5), 8)
      }
      const { decision } = detectCuts(result.profile, { calibration, parameters: ruleParameters })
      expect(decision).toMatchObject({ status: 'detected', cuts: result.cuts })
      expect(result.rule.strategy).toBe('terminal-first-rise')
      expect(result.rule.version).toBe('1.0.0')
      expect(result.retained).toEqual(clipProfile(result.profile.points, result.cuts))
      expect(result.volumeMm3).toBe(integrateVolumeMm3(result.retained))
      expect(result.dimensions.lengthMm).toBe(result.cuts.high - result.cuts.low)
      expect(result.dimensions.maximumDiameterMm).toBe(Math.max(...result.retained.map(p => p.radius)) * 2)
    })
  }
})
