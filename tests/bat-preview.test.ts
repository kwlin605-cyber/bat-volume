import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import BatPreview from '../src/components/bat-preview'
import { analyzeAnc } from '../src/domain/analyze'
import type { AnalysisResult } from '../src/domain/types'
import { text } from '../src/i18n/zh-TW'
import { ResultDialog } from '../src/features/batch/result-dialog'
import { MobilePreviewDialog } from '../src/components/mobile-preview-dialog'
import { PreviewModeSwitch, type PreviewMode } from '../src/components/preview-mode'
import { calculateBatProperties } from '../src/domain/bat-properties'
import { initialMaterialSettings } from '../src/config/weight'

const raw = readFileSync(new URL('./fixtures/case-001.anc', import.meta.url), 'utf8')
const result = analyzeAnc(raw, { name: 'preview.anc', size: raw.length })
if (result.status !== 'calculated') throw new Error('Expected calculated fixture')

const render = (value: AnalysisResult, mode: PreviewMode = 'trimmed', interactionHelp?: string) => renderToStaticMarkup(createElement(BatPreview, { result: value, mode, interactionHelp }))
const buttons = (markup: string) => [...markup.matchAll(/<button\b([^>]*)>([^<]*)<\/button>/g)].map(([, attributes, label]) => ({
  label, pressed: attributes.includes('aria-pressed="true"'), disabled: attributes.includes('disabled='),
}))

describe('shared 3D preview controls', () => {
  it('offers one accessible reset action, disabled until the first view is fitted', () => {
    const markup = render(result)
    expect(markup.match(new RegExp(`aria-label="${text.previewResetSize}"`, 'g'))).toHaveLength(1)
    expect(markup).toMatch(new RegExp(`<button[^>]*disabled=""[^>]*aria-label="${text.previewResetSize}"`))
    expect(markup).toContain(text.previewLoading)
  })
  it('reads mobile measurements first, then balance and MOI, with weight last while the model loads', () => {
    const properties = calculateBatProperties(result, initialMaterialSettings, { min: 840, max: 860 })
    const markup = renderToStaticMarkup(createElement(MobilePreviewDialog, { result, properties, onClose() {} }))
    const positions = [text.maximumDiameter, text.minimumGripDiameter, 'data-testid="property-balancePoint"', 'data-testid="property-moi"', 'data-testid="property-weight"'].map(value => markup.indexOf(value))
    expect(positions.every(position => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    for (const id of ['balancePoint', 'moi', 'weight']) expect(markup.match(new RegExp(`data-testid="property-${id}"`, 'g'))).toHaveLength(1)
    expect(markup).toContain('840 – 860')
    expect(markup).toContain(text.previewLoading)
  })

  it('opens desktop and mobile dialogs with one shared switch defaulting to trimmed on the left', () => {
    const original = JSON.stringify(result)
    const entry = { id: 'preview', source: result.source, state: { status: 'result' as const, result } }
    for (const markup of [
      renderToStaticMarkup(createElement(ResultDialog, { entry, onDismiss() {} })),
      renderToStaticMarkup(createElement(MobilePreviewDialog, { result, onClose() {} })),
    ]) {
      expect(buttons(markup).filter(button => button.label === text.trimmed || button.label === text.whole)).toEqual([
        { label: text.trimmed, pressed: true, disabled: false },
        { label: text.whole, pressed: false, disabled: false },
      ])
      expect(markup.match(/class="view-toggle"/g)).toHaveLength(1)
    }
    expect(JSON.stringify(result)).toBe(original)
  })

  it('accepts the mobile touch instructions and keeps the canvas free of duplicate controls and text labels', () => {
    const markup = render(result, 'trimmed', text.orbitTouchHelp)
    expect(markup).toContain(text.orbitTouchHelp)
    expect(markup).not.toContain(text.orbitHelp)
    expect(buttons(markup)).toHaveLength(0)
    expect(markup).not.toContain('section-label')
  })

  it('disables trimmed for partial geometry while preserving the whole option', () => {
    const partial: AnalysisResult = { status: 'undetermined', source: result.source, code: 'invalidCuts', profile: result.profile, partial: { low: result.cuts.low } }
    const markup = renderToStaticMarkup(createElement(ResultDialog, {
      entry: { id: 'partial', source: partial.source, state: { status: 'result', result: partial } }, onDismiss() {},
    }))
    expect(buttons(markup).filter(button => button.label === text.trimmed || button.label === text.whole)).toEqual([
      { label: text.trimmed, pressed: false, disabled: true },
      { label: text.whole, pressed: true, disabled: false },
    ])
    expect(render(partial)).toContain(text.orbitHelp)
    expect(render({ ...partial, partial: {} })).not.toContain('虛線為預計切線')
  })

  it.each(['trimmed', 'whole'] as const)('shows only operation instructions in %s', mode => {
    const markup = render(result, mode)
    expect(markup).toContain(text.orbitHelp)
    expect(markup).not.toContain('虛線為預計切線')
    const controls = renderToStaticMarkup(createElement(PreviewModeSwitch, { mode, canTrim: true, onChange() {} }))
    expect(buttons(controls).find(button => button.label === (mode === 'trimmed' ? text.trimmed : text.whole))?.pressed).toBe(true)
  })
})
