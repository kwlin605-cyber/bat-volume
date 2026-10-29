import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { themeCssVariables } from '../src/config/theme'

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? sources(join(directory, entry.name))
    : /\.(css|tsx)$/.test(entry.name) ? [join(directory, entry.name)] : [])
}

describe('shared theme contract between styles and application startup', () => {
  it('supplies every project color variable used by styles and utility classes, including portal selection colors', () => {
    const referenced = new Set<string>()
    for (const file of sources(fileURLToPath(new URL('../src', import.meta.url)))) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/var\((--(?:color|ui|selection)-[\w-]+)\)/g)) referenced.add(match[1])
    }
    expect(referenced.size).toBeGreaterThan(0)
    for (const name of referenced) expect(themeCssVariables[name], name).toBeTruthy()
    for (const name of ['--selection-background', '--selection-accent', '--selection-border']) {
      expect(referenced.has(name), name).toBe(true)
    }
  })
})
