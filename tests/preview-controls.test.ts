import { describe, expect, it } from 'vitest'
import { OrthographicCamera, Vector3 } from 'three'
import { OrbitControls } from 'three-stdlib'
import { rotationSpeedForHeight } from '../src/components/preview-controls'
import { previewInteraction } from '../src/config/preview'
import { attachCenteredOrbit } from '../src/components/centered-orbit'

// Only the browser event surface is substituted; camera motion uses real OrbitControls.
class InputSurface extends EventTarget {
  ownerDocument = new EventTarget()
  style = { touchAction: '' }
  clientWidth = 390
  constructor(public clientHeight: number) { super() }
  releasePointerCapture() {}
}

function pointer(type: string, input: 'mouse' | 'touch', x: number, y: number, button = 0, pointerId = 1) {
  return Object.assign(new Event(type, { cancelable: true }), {
    pointerId, pointerType: input, pageX: x, pageY: y, clientX: x, clientY: y, button,
  })
}

function setup(height: number) {
  const surface = new InputSurface(height)
  const camera = new OrthographicCamera(-195, 195, height / 2, -height / 2, 0.1, 20000)
  camera.position.set(0, 0, 1200)
  const controls = new OrbitControls(camera, surface as unknown as HTMLElement)
  controls.enableDamping = true
  controls.dampingFactor = previewInteraction.dampingFactor
  controls.rotateSpeed = rotationSpeedForHeight(height)
  return { surface, controls, camera }
}

function drag(surface: InputSurface, input: 'mouse' | 'touch', dx: number, dy: number) {
  surface.dispatchEvent(pointer('pointerdown', input, 100, 100))
  for (let step = 1; step <= 10; step++) surface.ownerDocument.dispatchEvent(pointer('pointermove', input, 100 + dx * step / 10, 100 + dy * step / 10))
  surface.ownerDocument.dispatchEvent(pointer('pointerup', input, 100 + dx, 100 + dy))
}

describe('rotation follows pixel distance independently of preview height', () => {
  it.each(['mouse', 'touch'] as const)('rotates 30 degrees per 100 pixels with %s in tall and short canvases', input => {
    for (const height of [290, 359, 420, 563, 720]) {
      const { surface, controls } = setup(height)
      try {
        drag(surface, input, 100, 0)
        const released = Math.abs(controls.getAzimuthalAngle())
        expect(released).toBeGreaterThan(0)
        expect(released).toBeLessThan(Math.PI / 6)
        for (let frame = 0; frame < 240; frame++) controls.update()
        expect(controls.getAzimuthalAngle()).toBeCloseTo(-Math.PI / 6, 8)
        const settled = controls.getAzimuthalAngle()
        for (let frame = 0; frame < 60; frame++) controls.update()
        expect(controls.getAzimuthalAngle()).toBeCloseTo(settled, 8)
        expect(controls.panSpeed).toBe(1)
        expect(controls.zoomSpeed).toBe(1)
      } finally { controls.dispose() }
    }
  })

  it('keeps vertical sensitivity after resizing and preserves a short damped finish', () => {
    const { surface, controls } = setup(320)
    try {
      drag(surface, 'mouse', 0, 50)
      for (let frame = 0; frame < 240; frame++) controls.update()
      const first = controls.getPolarAngle()
      expect(first).toBeCloseTo(Math.PI / 2 - Math.PI / 12, 8)
      surface.clientHeight = 700
      controls.rotateSpeed = rotationSpeedForHeight(surface.clientHeight)
      drag(surface, 'touch', 0, 50)
      for (let frame = 0; frame < 240; frame++) controls.update()
      expect(controls.getPolarAngle()).toBeCloseTo(first - Math.PI / 12, 8)
    } finally { controls.dispose() }
    expect(rotationSpeedForHeight(0)).toBe(0)
  })
})

function pan(surface: InputSurface, input: 'mouse' | 'touch', dx: number, dy: number) {
  const fingers = input === 'touch' ? [1, 2] : [1]
  const button = input === 'mouse' ? 2 : 0
  for (const id of fingers) surface.dispatchEvent(pointer('pointerdown', input, 100 * id, 100, button, id))
  for (let step = 1; step <= 10; step++) {
    for (const id of fingers) surface.ownerDocument.dispatchEvent(pointer('pointermove', input, 100 * id + dx * step / 10, 100 + dy * step / 10, button, id))
  }
  for (const id of fingers) surface.ownerDocument.dispatchEvent(pointer('pointerup', input, 100 * id + dx, 100 + dy, button, id))
}

function projected(camera: OrthographicCamera, point: Vector3) {
  camera.updateMatrixWorld()
  return point.clone().project(camera)
}

function settle(controls: OrbitControls) {
  for (let frame = 0; frame < 300; frame++) controls.update()
}

function zoom(surface: InputSurface, input: 'mouse' | 'touch') {
  if (input === 'mouse') {
    surface.dispatchEvent(Object.assign(new Event('wheel', { cancelable: true }), { deltaY: -100, clientX: 195, clientY: 150 }))
    return
  }
  surface.dispatchEvent(pointer('pointerdown', input, 100, 150, 0, 1))
  surface.dispatchEvent(pointer('pointerdown', input, 200, 150, 0, 2))
  for (let step = 1; step <= 10; step++) {
    surface.ownerDocument.dispatchEvent(pointer('pointermove', input, 100 - step * 2, 150, 0, 1))
    surface.ownerDocument.dispatchEvent(pointer('pointermove', input, 200 + step * 2, 150, 0, 2))
  }
  surface.ownerDocument.dispatchEvent(pointer('pointerup', input, 80, 150, 0, 1))
  surface.ownerDocument.dispatchEvent(pointer('pointerup', input, 220, 150, 0, 2))
}

describe('rotation around the displayed bat after panning', () => {
  it.each(['mouse', 'touch'] as const)('keeps the panned screen position through %s rotation and zoom', input => {
    for (const height of [320, 700]) {
      const { surface, controls, camera } = setup(height)
      const center = new Vector3(15, 0, 0)
      camera.position.add(center)
      controls.target.copy(center)
      controls.update()
      const detach = attachCenteredOrbit(controls, center, surface.clientWidth, height)
      try {
        const initial = projected(camera, center)
        pan(surface, input, 40, 30)
        settle(controls)
        const moved = projected(camera, center)
        expect(moved.x).toBeGreaterThan(initial.x)
        expect(moved.y).toBeLessThan(initial.y)
        drag(surface, input, 300, 80)
        settle(controls)
        const rotated = projected(camera, center)
        expect(rotated.x).toBeCloseTo(moved.x, 7)
        expect(rotated.y).toBeCloseTo(moved.y, 7)
        const beforeZoom = camera.zoom
        const end = center.clone().add(new Vector3(60, 0, 0))
        const beforeDistance = projected(camera, end).distanceTo(rotated)
        zoom(surface, input)
        settle(controls)
        expect(camera.zoom).not.toBe(beforeZoom)
        const zoomed = projected(camera, center)
        expect(projected(camera, end).distanceTo(zoomed)).toBeGreaterThan(beforeDistance)
        if (input === 'mouse') {
          expect(zoomed.x).toBeCloseTo(moved.x, 7)
          expect(zoomed.y).toBeCloseTo(moved.y, 7)
        }
        drag(surface, input, -120, -30)
        settle(controls)
        const afterZoomRotation = projected(camera, center)
        expect(afterZoomRotation.x).toBeCloseTo(zoomed.x, 7)
        expect(afterZoomRotation.y).toBeCloseTo(zoomed.y, 7)
        pan(surface, input, -20, 15)
        settle(controls)
        const movedAgain = projected(camera, center)
        expect(movedAgain.x).toBeLessThan(afterZoomRotation.x)
        drag(surface, input, 80, 25)
        settle(controls)
        expect(projected(camera, center).x).toBeCloseTo(movedAgain.x, 7)
        expect(projected(camera, center).y).toBeCloseTo(movedAgain.y, 7)
        expect(controls.target.distanceTo(center)).toBeLessThan(1e-8)
      } finally { detach(); controls.dispose() }
    }
  })

  it('does not jump when rotation starts with a target away from the displayed center', () => {
    const { surface, controls, camera } = setup(390)
    const center = new Vector3(25, 10, 0)
    const end = center.clone().add(new Vector3(60, 5, 0))
    const beforeCenter = projected(camera, center)
    const beforeEnd = projected(camera, end)
    const detach = attachCenteredOrbit(controls, center, 390, 390)
    try {
      surface.dispatchEvent(pointer('pointerdown', 'touch', 100, 100))
      expect(projected(camera, center).distanceTo(beforeCenter)).toBeLessThan(1e-8)
      expect(projected(camera, end).distanceTo(beforeEnd)).toBeLessThan(1e-8)
      expect(controls.target.distanceTo(center)).toBeLessThan(1e-8)
      surface.ownerDocument.dispatchEvent(pointer('pointerup', 'touch', 100, 100))
    } finally { detach(); controls.dispose() }
  })

  it('clears screen panning and listeners before reframing a new center or canvas size', () => {
    const { surface, controls, camera } = setup(390)
    const center = new Vector3()
    const detach = attachCenteredOrbit(controls, center, 390, 390)
    pan(surface, 'mouse', 40, 30)
    settle(controls)
    expect(projected(camera, center).x).toBeGreaterThan(0)
    detach()
    expect(camera.view?.enabled).toBe(false)
    pan(surface, 'mouse', 20, 10)
    settle(controls)
    expect(controls.target.distanceTo(center)).toBeGreaterThan(0)
    const nextCenter = new Vector3(-30, 0, 0)
    surface.clientWidth = 700
    surface.clientHeight = 320
    camera.left = -350
    camera.right = 350
    camera.top = 160
    camera.bottom = -160
    camera.position.set(-30, 0, 1200)
    controls.target.copy(nextCenter)
    controls.update()
    camera.updateProjectionMatrix()
    const detachNext = attachCenteredOrbit(controls, nextCenter, 700, 320)
    try {
      expect(projected(camera, nextCenter).x).toBeCloseTo(0, 8)
      expect(projected(camera, nextCenter).y).toBeCloseTo(0, 8)
      pan(surface, 'touch', 40, 30)
      settle(controls)
      const moved = projected(camera, nextCenter)
      drag(surface, 'touch', 100, 50)
      settle(controls)
      expect(projected(camera, nextCenter).x).toBeCloseTo(moved.x, 7)
      expect(projected(camera, nextCenter).y).toBeCloseTo(moved.y, 7)
    } finally { detachNext(); controls.dispose() }
  })
})
