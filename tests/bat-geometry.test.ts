import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { analyzeAnc } from '../src/domain/analyze'
import { createBatGeometry } from '../src/components/bat-geometry'

describe('3D geometry generated from the shared full profile', () => {
  it('keeps every source radius, exact turn and vertical step in whole and trimmed views', () => {
    const text = readFileSync(new URL('../src/assets/anc/劉/WT320.33.anc', import.meta.url), 'utf8')
    const result = analyzeAnc(text, { name: 'WT320.33.anc', size: text.length }, undefined, undefined, 5)
    if (result.status !== 'calculated') throw new Error('Expected a calculated bat')
    const center = (result.profile.range.low + result.profile.range.high) / 2
    for (const points of [result.profile.points, result.retained]) {
      const before = structuredClone(points)
      const geometry = createBatGeometry(points, center)
      try {
        const path = geometry.parameters.points
        expect(path).toHaveLength(points.length + 2)
        expect(path[0].x).toBe(0)
        expect(path.at(-1)!.x).toBe(0)
        const positions = geometry.getAttribute('position')
        expect(positions.count).toBe((geometry.parameters.segments + 1) * path.length)
        for (let i = 0; i < points.length; i++) {
          expect(path[i + 1].x).toBe(points[i].radius)
          expect(path[i + 1].y).toBe(points[i].y - center)
          // Float32 vertices are only a display representation; domain values remain doubles.
          expect(positions.getY(i + 1)).toBeCloseTo(points[i].y - center, 4)
          expect(positions.getZ(i + 1)).toBeCloseTo(points[i].radius, 4)
        }
        expect(points).toEqual(before)
      } finally { geometry.dispose() }
    }
  })
})
