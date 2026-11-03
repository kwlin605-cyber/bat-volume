import { describe, expect, it } from 'vitest'
import { OrthographicCamera, Vector3 } from 'three'
import { fitPreview, previewCircle, previewFrame } from '../src/components/preview-framing'

function screen(camera: OrthographicCamera, point: Vector3, width: number, height: number) {
  camera.updateMatrixWorld()
  const ndc = point.clone().project(camera)
  return { x: (ndc.x + 1) * width / 2, y: (1 - ndc.y) * height / 2, z: ndc.z }
}

describe('preview rotation envelope and available circle', () => {
  it('includes the actual radial profile and visible rings around the axial midpoint', () => {
    const points = [{ y: 100, radius: 20 }, { y: 500, radius: 120 }, { y: 900, radius: 30 }]
    const original = structuredClone(points)
    const frame = previewFrame(points, 510)
    expect(frame.center.toArray()).toEqual([10, 0, 0])
    expect(frame.radius).toBeCloseTo(Math.hypot(400, 30), 10)
    const marked = previewFrame(points, 510, [{ y: 900, radius: 70 }])
    expect(marked.radius).toBeCloseTo(Math.hypot(400, 70), 10)
    expect(points).toEqual(original)
  })

  it.each([
    [{ width: 390, height: 390, hintTop: 350 }, { x: 195, y: 175, diameter: 350 }],
    [{ width: 800, height: 450, hintTop: 410 }, { x: 400, y: 205, diameter: 410 }],
    [{ width: 320, height: 720, hintTop: 680 }, { x: 160, y: 340, diameter: 320 }],
    [{ width: 390, height: 390, hintTop: 320 }, { x: 195, y: 160, diameter: 320 }],
  ])('finds the circle above the measured hint in %j', (area, expected) => {
    expect(previewCircle(area)).toEqual(expected)
  })

  it('waits for a positive measured area and rejects invalid model bounds', () => {
    for (const area of [{ width: 0, height: 390, hintTop: 350 }, { width: 390, height: 0, hintTop: 0 }, { width: 390, height: 390, hintTop: -1 }]) {
      expect(previewCircle(area)).toBeNull()
    }
    expect(() => previewFrame([], 0)).toThrow()
    expect(() => previewFrame([{ y: 0, radius: 0 }], 0)).toThrow()
    expect(() => previewFrame([{ y: 0, radius: NaN }], 0)).toThrow()
  })
})

describe('96 percent camera framing', () => {
  it.each([
    { width: 390, height: 390, hintTop: 350 },
    { width: 800, height: 450, hintTop: 410 },
    { width: 320, height: 720, hintTop: 680 },
  ])('centers the full rotation envelope without changing the viewing angle in %j', area => {
    const camera = new OrthographicCamera(-area.width / 2, area.width / 2, area.height / 2, -area.height / 2, 0.1, 20000)
    camera.position.set(300, 140, 1200)
    camera.up.set(0.2, 1, 0.1).normalize()
    camera.lookAt(0, 0, 0)
    camera.zoom = 5
    camera.setViewOffset(area.width, area.height, -60, 40, area.width, area.height)
    const before = camera.quaternion.clone()
    const up = camera.up.clone()
    const frame = { center: new Vector3(40, 0, 0), radius: 450 }
    const circle = previewCircle(area)!
    expect(fitPreview(camera, frame, area, 500)).toBe(true)
    expect(camera.quaternion.angleTo(before)).toBeLessThan(1e-7)
    expect(camera.up.distanceTo(up)).toBeLessThan(1e-10)
    const center = screen(camera, frame.center, area.width, area.height)
    expect(center.x).toBeCloseTo(circle.x, 8)
    expect(center.y).toBeCloseTo(circle.y, 8)
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
      const point = new Vector3(Math.cos(angle), Math.sin(angle), 0).applyQuaternion(camera.quaternion).multiplyScalar(frame.radius).add(frame.center)
      const projected = screen(camera, point, area.width, area.height)
      expect(Math.hypot(projected.x - center.x, projected.y - center.y)).toBeCloseTo(circle.diameter * 0.96 / 2, 7)
      expect(projected.y).toBeLessThan(area.hintTop)
      expect(projected.y).toBeGreaterThan(0)
      expect(projected.x).toBeGreaterThan(0)
      expect(projected.x).toBeLessThan(area.width)
    }
    for (const direction of [-1, 1]) {
      const front = camera.getWorldDirection(new Vector3()).multiplyScalar(direction * frame.radius).add(frame.center)
      expect(Math.abs(screen(camera, front, area.width, area.height).z)).toBeLessThan(1)
    }
  })
})
