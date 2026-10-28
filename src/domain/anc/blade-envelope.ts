import { AnalysisError } from '../types'
import type { GeometryCalibration, Profile, ProfilePoint, Program } from '../types'

interface BladeSpan {
  low: number
  high: number
  lowRadius: number
  highRadius: number
  line: number
}
interface EnvelopePiece { low: number; high: number; source: BladeSpan }

function radiusAt(span: BladeSpan, y: number): number {
  if (y === span.low) return span.lowRadius
  if (y === span.high) return span.highRadius
  return span.lowRadius + (span.highRadius - span.lowRadius) * ((y - span.low) / (span.high - span.low))
}

function append(pieces: EnvelopePiece[], source: BladeSpan, low: number, high: number) {
  if (!(high > low)) return
  const previous = pieces.at(-1)
  // Joining pieces of the very same line changes no coordinates or shape.
  if (previous?.source === source && previous.high === low) previous.high = high
  else pieces.push({ low, high, source })
}

/** Merge two lower envelopes, retaining every change of slope and vertical step. */
function merge(a: EnvelopePiece[], b: EnvelopePiece[]): EnvelopePiece[] {
  const result: EnvelopePiece[] = []
  let i = 0, j = 0
  let y = Math.min(a[0]?.low ?? Infinity, b[0]?.low ?? Infinity)
  while (i < a.length || j < b.length) {
    while (i < a.length && a[i].high <= y) i++
    while (j < b.length && b[j].high <= y) j++
    const left = a[i]?.low <= y ? a[i] : undefined
    const right = b[j]?.low <= y ? b[j] : undefined
    const end = Math.min(left?.high ?? a[i]?.low ?? Infinity, right?.high ?? b[j]?.low ?? Infinity)
    if (!Number.isFinite(end)) break
    if (left && right) {
      const startDifference = radiusAt(left.source, y) - radiusAt(right.source, y)
      const endDifference = radiusAt(left.source, end) - radiusAt(right.source, end)
      const crosses = (startDifference < 0 && endDifference > 0) || (startDifference > 0 && endDifference < 0)
      const crossing = crosses ? y + (end - y) * (startDifference / (startDifference - endDifference)) : y
      if (crossing > y && crossing < end) {
        append(result, startDifference < 0 ? left.source : right.source, y, crossing)
        append(result, endDifference < 0 ? left.source : right.source, crossing, end)
      } else {
        const middle = y + (end - y) / 2
        append(result, radiusAt(left.source, middle) <= radiusAt(right.source, middle) ? left.source : right.source, y, end)
      }
    } else if (left || right) {
      append(result, (left ?? right)!.source, y, end)
    }
    y = end
  }
  return result
}

function lowerEnvelope(spans: BladeSpan[], low = 0, high = spans.length): EnvelopePiece[] {
  if (low === high) return []
  if (high - low === 1) return [{ low: spans[low].low, high: spans[low].high, source: spans[low] }]
  const middle = low + Math.floor((high - low) / 2)
  return merge(lowerEnvelope(spans, low, middle), lowerEnvelope(spans, middle, high))
}

/** Exact piecewise-linear boundary for a flat blade centered on each programmed Y. */
export function extractBladeEnvelope(program: Program, calibration: GeometryCalibration, widthMm: number): Profile {
  const half = widthMm / 2
  const spans: BladeSpan[] = []
  for (const sweep of program.sweeps) {
    for (let i = 1; i < sweep.points.length; i++) {
      let a = sweep.points[i - 1], b = sweep.points[i]
      if (a.y > b.y) [a, b] = [b, a]
      const r0 = a.z * calibration.radiusScale + calibration.radiusOffsetMm
      const r1 = b.z * calibration.radiusScale + calibration.radiusOffsetMm
      if (!Number.isFinite(r0) || r0 < 0 || !Number.isFinite(r1) || r1 < 0) throw new AnalysisError('invalidRadius')
      const line = sweep.points[i].line
      const add = (low: number, high: number, lowRadius: number, highRadius: number) => {
        if (high > low) spans.push({ low, high, lowRadius, highRadius, line })
      }
      if (a.y === b.y || r0 === r1) {
        add(a.y - half, b.y + half, Math.min(r0, r1), Math.min(r0, r1))
      } else if (r0 < r1) {
        add(a.y - half, a.y + half, r0, r0)
        add(a.y + half, b.y + half, r0, r1)
      } else {
        add(a.y - half, b.y - half, r0, r1)
        add(b.y - half, b.y + half, r1, r1)
      }
    }
  }

  const envelope = lowerEnvelope(spans)
  const points: ProfilePoint[] = []
  for (const piece of envelope) {
    const previous = points.at(-1)
    // No stock surface is known in a gap; do not bridge it with invented wood.
    if (previous && previous.y < piece.low) throw new AnalysisError('noProfile')
    const start = { y: piece.low, radius: radiusAt(piece.source, piece.low), line: piece.source.line }
    if (!previous || previous.y !== start.y || previous.radius !== start.radius) points.push(start)
    points.push({ y: piece.high, radius: radiusAt(piece.source, piece.high), line: piece.source.line })
  }
  if (points.length < 2) throw new AnalysisError('noProfile')
  return {
    points,
    range: { low: points[0].y, high: points.at(-1)!.y },
    sourceLines: {
      start: program.sweeps[0]?.points[0]?.line ?? 1,
      end: program.sweeps.at(-1)?.points.at(-1)?.line ?? 1,
    },
    sweepCount: program.sweeps.length,
  }
}
