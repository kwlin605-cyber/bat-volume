import { AnalysisError } from '../types'
import type { Profile, ProfilePoint } from '../types'

/** At a vertical step, clipping keeps the interior side; a scan sees the deepest cut. */
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

/** The legacy cut detector's scan is derived from, and never replaces, the full shape. */
export function sampleProfile(profile: Profile, spacingMm: number): Profile {
  if (!Number.isFinite(spacingMm) || spacingMm <= 0) throw new AnalysisError('noProfile')
  const points: ProfilePoint[] = []
  // Keep the existing scan phase (integer origin + n * spacing) and range.
  const origin = Math.floor(profile.range.low)
  const first = Math.ceil((profile.range.low - origin) / spacingMm)
  const last = Math.floor((profile.range.high - origin) / spacingMm)
  for (let i = first; i <= last; i++) {
    const y = origin + i * spacingMm
    if (y >= profile.range.low && y <= profile.range.high) points.push(profilePointAt(profile.points, y))
  }
  if (!points.length) throw new AnalysisError('noProfile')
  return { ...profile, points, range: { low: points[0].y, high: points.at(-1)!.y } }
}
