import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { analyzeAnc } from '../src/domain/analyze'
import { createBatGeometry } from '../src/components/bat-geometry'
import { MobileResultView } from '../src/components/mobile-result-view'
import { allMetricIds } from '../src/features/batch/columns'
import { buildBatchView } from '../src/features/batch/view-model'
import type { WeightRange } from '../src/domain/weight'

describe('cut result shared by desktop, mobile, weights and the trimmed mesh', () => {
  it.each(['拿/318-V2.anc', '劉/X-56-860.anc', '劉/WT320.33.anc'])('%s', file => {
    const raw = readFileSync(new URL(`../src/assets/anc/${file}`, import.meta.url), 'utf8')
    const result = analyzeAnc(raw, { name: file, size: raw.length }, undefined, undefined, 5)
    if (result.status !== 'calculated') throw new Error('Expected a calculated bat')
    const geometry = createBatGeometry(result.retained, (result.profile.range.low + result.profile.range.high) / 2)
    try {
      const vertices = geometry.getAttribute('position'), indices = geometry.getIndex()!
      let signedSixVolume = 0
      // Closed triangle-mesh volume is independent of the profile's frustum integrator.
      for (let i = 0; i < indices.count; i += 3) {
        const a = indices.getX(i), b = indices.getX(i + 1), c = indices.getX(i + 2)
        signedSixVolume += vertices.getX(a) * (vertices.getY(b) * vertices.getZ(c) - vertices.getZ(b) * vertices.getY(c))
          + vertices.getY(a) * (vertices.getZ(b) * vertices.getX(c) - vertices.getX(b) * vertices.getZ(c))
          + vertices.getZ(a) * (vertices.getX(b) * vertices.getY(c) - vertices.getY(b) * vertices.getX(c))
      }
      // The rendered circular sections are regular polygons, stored in Float32.
      const segments = geometry.parameters.segments
      const polygonFactor = segments * Math.sin(2 * Math.PI / segments) / (2 * Math.PI)
      const meshVolumeCm3 = Math.abs(signedSixVolume) / 6 / polygonFactor / 1000
      expect(meshVolumeCm3 / result.volumeCm3).toBeCloseTo(1, 6)
      const axial = geometry.parameters.points.map(point => point.y)
      expect(Math.max(...axial) - Math.min(...axial)).toBeCloseTo(result.cuts.high - result.cuts.low, 10)

      const material = { referenceDensity: 0.7, volumeCm3: 3000, weightG: null, weightErrorPercent: -3 }
      const entry = { id: 'bat', source: result.source, state: { status: 'result' as const, result } }
      for (const requirement of [null, { min: 800.123, max: 850.789 }] as (WeightRange | null)[]) {
        const view = buildBatchView([entry], allMetricIds, { key: 'name', direction: 'asc' }, {
          material, requirements: requirement ? { bat: requirement } : {}, weightUnit: 'g',
        }, 'cm')
        const cells = view.rows[0].cells
        expect(cells.volume.value).toBe(result.volumeCm3)
        expect(cells.length.value).toBe(result.cuts.high - result.cuts.low)
        expect(cells.maximumDiameter.value).toBe(Math.max(...result.retained.map(point => point.radius)) * 2)
        expect(cells.batWeight.value).toBe(requirement ? requirement.min : result.volumeCm3 * 0.7 * 0.97)
        expect(cells.materialWeight.value).toBeCloseTo(requirement
          ? requirement.min * (3000 / result.volumeCm3 / 0.97) : 3000 * 0.7, 9)
        if (requirement) expect(cells.materialWeight.maximum).toBeCloseTo(requirement.max * (3000 / result.volumeCm3 / 0.97), 9)

        const markup = renderToStaticMarkup(createElement(MobileResultView, {
          entry, material, requirement, weightUnit: 'g', lengthUnit: 'cm',
          onMaterialOpen() {}, onOpenLibrary() {},
        }))
        const displayedWeights = [...markup.matchAll(/class="mobile-weight-val(?: [^"]*)?">([^<]*)/g)].map(match => match[1])
        expect(displayedWeights).toEqual([cells.batWeight.display, cells.materialWeight.display])
        for (const key of ['volume', 'length', 'maximumDiameter', 'gripDiameter'] as const) {
          expect(markup).toContain(`>${cells[key].display}</span>`)
        }
      }
    } finally { geometry.dispose() }
  })
})
