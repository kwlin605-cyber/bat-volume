import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PresetLibraryDialog } from '../src/components/preset-library-dialog'
import { MobilePresetDrawer } from '../src/components/mobile-preset-drawer'
import { getAncCatalog } from '../src/services/anc-catalog'

describe('catalog selection follows the exact source rather than the displayed name', () => {
  const duplicates = getAncCatalog().flatMap(group => group.directItems).filter(item => item.name === '243.anc')
  it.each([['desktop', PresetLibraryDialog], ['mobile', MobilePresetDrawer]] as const)('marks only the selected vendor on %s', (_, Component) => {
    expect(duplicates.length).toBeGreaterThan(1)
    const markup = renderToStaticMarkup(createElement(Component, {
      currentPresetIds: new Set([duplicates[0].id]), onSelect() {}, onDismiss() {},
    }))
    expect(markup.match(/preset-added-pill/g)).toHaveLength(1)
    const cards = markup.split('<button').filter(card => /243<\/(?:div|span)>/.test(card))
    expect(cards).toHaveLength(duplicates.length)
    expect(cards.filter(card => card.includes('preset-added-pill'))).toHaveLength(1)
  })
})
