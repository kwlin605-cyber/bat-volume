import { LatheGeometry, Vector2 } from 'three'
import type { ProfilePoint } from '../domain/types'

/** Display the same full profile used for measurement; only translate its origin. */
export function createBatGeometry(points: ProfilePoint[], center: number): LatheGeometry {
  return new LatheGeometry([
    new Vector2(0, points[0].y - center),
    ...points.map(point => new Vector2(point.radius, point.y - center)),
    new Vector2(0, points.at(-1)!.y - center),
  ], 96)
}
