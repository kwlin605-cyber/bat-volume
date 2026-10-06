import { AnalysisError } from '../types'
import type { FeedSweep, Program, RawPoint } from '../types'

const words = /([A-Z])\s*([-+]?(?:\d+(?:\.\d*)?|\.\d+))/gi
const supportedG = new Set([0, 1, 17, 18, 19, 21, 40, 49, 53, 54, 90, 94])

export function parseAnc(text: string): Program {
  if (!text.trim()) throw new AnalysisError('emptyProgram')
  const sweeps: FeedSweep[] = []
  let current: RawPoint[] = []
  let mode: number | null = null
  let x = 0, y = 0, z = 0
  const lines = text.split(/\r?\n/)

  function finish() {
    const lastY = current.findLastIndex(point => point.hasY)
    // A modal G1 retract after the final Y move is not part of the wood surface.
    const points = lastY < 0 ? [] : current.slice(0, lastY + 1)
    if (points.length >= 3) {
      const range = points.reduce((range, point) => ({ low: Math.min(range.low, point.y), high: Math.max(range.high, point.y) }), { low: Infinity, high: -Infinity })
      sweeps.push({ points, span: range.high - range.low })
    }
    current = []
  }

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].split(';', 1)[0].replace(/\([^)]*\)/g, '').trim().toUpperCase()
    if (!line || line === '%') continue
    if (/[XYZ]\s*(?:\[|#)/.test(line)) throw new AnalysisError('unsupportedInstruction', `${index + 1}`)
    const tokens = Array.from(line.matchAll(words), match => ({ key: match[1], value: Number(match[2]) }))
    if (tokens.some(token => 'BCUVW'.includes(token.key) || (token.key === 'A' && token.value !== 0))) {
      throw new AnalysisError('unsupportedInstruction', `${index + 1}`)
    }
    const gCodes = tokens.filter(token => token.key === 'G').map(token => token.value)
    for (const code of gCodes) {
      if (!supportedG.has(code)) throw new AnalysisError('unsupportedInstruction', `G${code} @ ${index + 1}`)
    }
    if (gCodes.includes(53)) { finish(); continue }
    for (const code of gCodes) {
      if (code === 0 || code === 1) {
        if (code !== mode) finish()
        mode = code
      }
    }
    const axes = tokens.filter(token => ['X', 'Y', 'Z'].includes(token.key))
    for (const axis of axes) {
      if (!Number.isFinite(axis.value) || Math.abs(axis.value) > 1_000_000) {
        throw new AnalysisError('invalidCoordinate', `${index + 1}`)
      }
      if (axis.key === 'X') x = axis.value
      if (axis.key === 'Y') y = axis.value
      if (axis.key === 'Z') z = axis.value
    }
    if (mode === 1 && axes.length) {
      current.push({ x, y, z, line: index + 1, hasY: axes.some(axis => axis.key === 'Y') })
    }
    if (tokens.some(token => token.key === 'M' && (token.value === 2 || token.value === 30))) finish()
  }
  finish()
  return { sweeps, lineCount: lines.length }
}
