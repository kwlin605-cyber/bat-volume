import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MaterialDialog } from '../src/features/batch/material-dialog'
import { initialMaterialSettings } from '../src/config/weight'
import { DisplayUnitSettings } from '../src/features/batch/display-unit-settings'
import { text } from '../src/i18n/zh-TW'

const mobileMarkup = () => renderToStaticMarkup(createElement(MaterialDialog, {
  value: initialMaterialSettings, bladeWidthMm: 5, onBladeWidthChange() {}, onApply() {}, onDismiss() {},
  unitPreferences: createElement(DisplayUnitSettings, {
    weightUnit: 'g', lengthUnit: 'cm', massUnits: { balance: 'in', inertia: 'oz-in2' },
    onWeightUnitChange() {}, onLengthUnitChange() {}, onMassUnitsChange() {},
  }),
}))

describe('settings dialog focus', () => {
  it('gives initial focus to the heading instead of a number input', () => {
    const markup = renderToStaticMarkup(createElement(MaterialDialog, {
      value: initialMaterialSettings, onApply() {}, onDismiss() {},
    }))
    const heading = markup.match(/<h2\b[^>]*>/)?.[0]
    expect(heading).toContain('tabindex="-1"')
    expect(heading).toContain('autofocus=""')
    expect(markup).not.toMatch(/<input\b[^>]*autofocus/)
  })

  it('uses the same non-input initial focus for mobile settings', () => {
    const markup = mobileMarkup()
    expect(markup).toMatch(/<h2\b[^>]*tabindex="-1"[^>]*autofocus=""[^>]*>設定<\/h2>/)
    expect(markup).not.toMatch(/<input\b[^>]*autofocus/)
  })
})

describe('mobile settings presentation', () => {
  it('keeps desktop settings focused on the material form', () => {
    const markup = renderToStaticMarkup(createElement(MaterialDialog, {
      value: initialMaterialSettings, bladeWidthMm: 5, onBladeWidthChange() {}, onApply() {}, onDismiss() {},
    }))
    expect(markup).toContain(text.materialSettings)
    expect(markup).toContain(text.referenceDensity)
    expect(markup).toContain(text.bladeWidth)
    expect(markup).not.toContain('role="tab"')
    expect(markup).not.toContain('unit-selector')
  })

  it('opens on the material tab with correctly connected tab panels', () => {
    const markup = mobileMarkup()
    const tabs = [...markup.matchAll(/<button\b[^>]*role="tab"[^>]*>([^<]+)<\/button>/g)]
    expect(tabs.map(match => match[1])).toEqual([text.materialSettings, text.displayUnits])
    expect(tabs[0][0]).toContain('aria-selected="true"')
    expect(tabs[0][0]).toContain('tabindex="0"')
    expect(tabs[1][0]).toContain('aria-selected="false"')
    expect(tabs[1][0]).toContain('tabindex="-1"')
    for (const tab of tabs) {
      const tabId = tab[0].match(/id="([^"]+)"/)![1]
      const panelId = tab[0].match(/aria-controls="([^"]+)"/)![1]
      expect(markup).toContain(`id="${panelId}" aria-labelledby="${tabId}"`)
    }
    expect(markup).toMatch(/<section\b[^>]*-secondary-panel[^>]*hidden=""/)
  })

  it('keeps units outside the material form and renders the current unit choices', () => {
    const markup = mobileMarkup()
    const form = markup.match(/<form\b[\s\S]*?<\/form>/)![0]
    expect(form).toContain(text.referenceDensity)
    expect(form).toContain(text.bladeWidth)
    expect(form).toContain(text.applySettings)
    expect(form).not.toContain('unit-selector')
    const units = markup.slice(markup.indexOf('class="settings-unit-preferences"'))
    expect(units.match(/<fieldset/g)).toHaveLength(4)
    expect(units.match(/aria-pressed="true"/g)).toHaveLength(4)
    expect(units).toMatch(/aria-pressed="true"[^>]*>cm<\/button>/)
    expect(units).toMatch(/aria-pressed="true"[^>]*>g<\/button>/)
    expect(units).toMatch(/aria-pressed="true"[^>]*>in<\/button>/)
    expect(units).toMatch(/aria-pressed="true"[^>]*>oz·in²<\/button>/)
    expect(units).not.toContain('type="submit"')
    expect(units).not.toContain(text.cancel)
    expect(units).not.toContain(text.applySettings)
  })
})
