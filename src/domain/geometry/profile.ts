import { AnalysisError } from '../types'
import type { ProfilePoint } from '../types'

/** At a vertical step, clipping selects the interior side; point queries default to the deepest cut. */
export function profilePointAt(points: ProfilePoint[], y: number, side: 'left' | 'right' | 'minimum' = 'minimum'): ProfilePoint {
  let low = 0, high = points.length
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2)
    if (points[middle].y < y) low = middle + 1
    else high = middle
  }
  const next = points[low]
  if (next?.y === y) {
    let end = low
    while (end + 1 < points.length && points[end + 1].y === y) end++
    if (side === 'left') return next
    if (side === 'right') return points[end]
    let minimum = next
    for (let i = low + 1; i <= end; i++) if (points[i].radius < minimum.radius) minimum = points[i]
    return minimum
  }
  const previous = points[low - 1]
  if (!previous || !next) throw new AnalysisError('invalidCuts')
  const fraction = (y - previous.y) / (next.y - previous.y)
  return { y, radius: previous.radius + (next.radius - previous.radius) * fraction, line: next.line }
}
