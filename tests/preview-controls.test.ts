import { describe, expect, it } from 'vitest'
import { OrthographicCamera } from 'three'
import { OrbitControls } from 'three-stdlib'
import { rotationSpeedForHeight } from '../src/components/preview-controls'
import { previewInteraction } from '../src/config/preview'

// Only the browser event surface is substituted; camera motion uses real OrbitControls.
class InputSurface extends EventTarget {
  ownerDocument = new EventTarget()
  style = { touchAction: '' }
  clientWidth = 390
  constructor(public clientHeight: number) { super() }
  releasePointerCapture() {}
}

function pointer(type: string, input: 'mouse' | 'touch', x: number, y: number, button = 0) {
  return Object.assign(new Event(type, { cancelable: true }), {
    pointerId: 1, pointerType: input, pageX: x, pageY: y, clientX: x, clientY: y, button,
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
  return { surface, controls }
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
