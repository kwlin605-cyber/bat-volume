import { OrthographicCamera, Vector3 } from 'three'
import type { ProfilePoint } from '../domain/types'
import { previewFraming } from '../config/preview'

export type PreviewFrame = { center: Vector3; radius: number }
export type PreviewArea = { width: number; height: number; hintTop: number }

type RadialPoint = Pick<ProfilePoint, 'y' | 'radius'>

export function previewFrame(points: RadialPoint[], origin: number, rings: RadialPoint[] = []): PreviewFrame {
  if (points.length === 0) throw new Error('Cannot frame an empty preview')
  const midpoint = (points[0].y + points.at(-1)!.y) / 2
  // Every surface point rotates at this distance from the axial midpoint.
  let radius = 0
  for (const point of points.concat(rings)) radius = Math.max(radius, Math.hypot(point.y - midpoint, point.radius))
  if (!Number.isFinite(radius) || radius <= 0) throw new Error('Cannot frame an invalid preview')
  return { center: new Vector3(origin - midpoint, 0, 0), radius }
}

export function previewCircle(area: PreviewArea) {
  const { width, height, hintTop } = area
  if (![width, height, hintTop].every(Number.isFinite) || width <= 0 || height <= 0 || hintTop <= 0) return null
  const usableHeight = Math.min(height, hintTop)
  return { x: width / 2, y: usableHeight / 2, diameter: Math.min(width, usableHeight) }
}

export function fitPreview(camera: OrthographicCamera, frame: PreviewFrame, area: PreviewArea, sceneRadius: number) {
  const circle = previewCircle(area)
  if (!circle) return false
  const pixelsPerUnit = Math.min(area.width / (camera.right - camera.left), area.height / (camera.top - camera.bottom))
  const distance = sceneRadius * previewFraming.cameraRadiusMultiplier
  const direction = camera.getWorldDirection(new Vector3())
  camera.position.copy(frame.center).addScaledVector(direction, -distance)
  camera.zoom = circle.diameter * previewFraming.fillRatio / (2 * frame.radius * pixelsPerUnit)
  camera.near = Math.max(0.01, distance / 10000)
  camera.far = distance + sceneRadius * previewFraming.cameraRadiusMultiplier
  camera.setViewOffset(area.width, area.height, area.width / 2 - circle.x, area.height / 2 - circle.y, area.width, area.height)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld()
  return true
}
