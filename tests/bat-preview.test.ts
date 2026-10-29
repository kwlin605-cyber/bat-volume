import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import BatPreview from '../src/components/bat-preview'
import { analyzeAnc } from '../src/domain/analyze'
import type { AnalysisResult } from '../src/domain/types'
import { text } from '../src/i18n/zh-TW'

const raw = readFileSync(new URL('./fixtures/case-001.anc', import.meta.url), 'utf8')
const result = analyzeAnc(raw, { name: 'preview.anc', size: raw.length })
if (result.status !== 'calculated') throw new Error('Expected calculated fixture')

const render = (value: AnalysisResult, interactionHelp?: string) => renderToStaticMarkup(createElement(BatPreview, { result: value, interactionHelp }))
const buttons = (markup: string) => [...markup.matchAll(/<button\b([^>]*)>([^<]*)<\/button>/g)].map(([, attributes, label]) => ({
  label, pressed: attributes.includes('aria-pressed="true"'), disabled: attributes.includes('disabled='),
}))

describe('shared 3D preview controls', () => {
  it('opens each calculated preview with trimmed selected on the left and no cut legend', () => {
    const original = JSON.stringify(result)
    for (let opening = 0; opening < 2; opening++) {
      const markup = render(result)
      expect(buttons(markup)).toEqual([
        { label: text.trimmed, pressed: true, disabled: false },
        { label: text.whole, pressed: false, disabled: false },
      ])
      expect(markup).not.toContain(text.linesLegend)
      expect(markup).toContain(text.orbitHelp)
      expect(markup).toContain(text.maximumDiameter)
      expect(markup).toContain(text.minimumGripDiameter)
    }
    expect(JSON.stringify(result)).toBe(original)
  })

  it('accepts the mobile touch instructions without changing the preview mode', () => {
    const markup = render(result, text.orbitTouchHelp)
    expect(markup).toContain(text.orbitTouchHelp)
    expect(markup).not.toContain(text.orbitHelp)
    expect(buttons(markup)[0].pressed).toBe(true)
  })

  it('falls back to whole for partial geometry and only describes cuts that are available', () => {
    const partial: AnalysisResult = { status: 'undetermined', source: result.source, code: 'invalidCuts', profile: result.profile, partial: { low: result.cuts.low } }
    const markup = render(partial)
    expect(buttons(markup)).toEqual([
      { label: text.trimmed, pressed: false, disabled: true },
      { label: text.whole, pressed: true, disabled: false },
    ])
    expect(markup).toContain(text.linesLegend)
    expect(render({ ...partial, partial: {} })).not.toContain(text.linesLegend)
    expect(markup).not.toContain('data-testid="marker-maximum"')
  })
})
