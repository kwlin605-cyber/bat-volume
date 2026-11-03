import { describe, expect, it } from 'vitest'
import { OrthographicCamera, Vector3 } from 'three'
import { OrbitControls } from 'three-stdlib'
import { attachPointerRotation } from '../src/components/pointer-rotation'
import { previewInteraction } from '../src/config/preview'
import { attachCenteredOrbit } from '../src/components/centered-orbit'
import { createPreviewView } from '../src/components/preview-view'

// Only the browser event surface is substituted; both production controllers and camera math run.
class InputSurface extends EventTarget {
  ownerDocument = new EventTarget()
  style = { touchAction: '' }
  clientWidth = 390
  left = 0
  top = 0
  constructor(public clientHeight: number) { super() }
  releasePointerCapture() {}
  getBoundingClientRect() { return { left: this.left, top: this.top, width: this.clientWidth, height: this.clientHeight } }
}

const rotations = new WeakMap<OrbitControls, ReturnType<typeof attachPointerRotation>>()

function pointer(type: string, input: 'mouse' | 'touch', x: number, y: number, button = 0, pointerId = 1) {
  return Object.assign(new Event(type, { cancelable: true }), {
    pointerId, pointerType: input, pageX: x, pageY: y, clientX: x, clientY: y, button,
  })
}

function setup(height: number, center = new Vector3()) {
  const surface = new InputSurface(height)
  const camera = new OrthographicCamera(-195, 195, height / 2, -height / 2, 0.1, 20000)
  camera.position.set(0, 0, 1200)
  const controls = new OrbitControls(camera, surface as unknown as HTMLElement)
  controls.enableDamping = true
  controls.dampingFactor = previewInteraction.dampingFactor
  controls.enableRotate = false
  const rotation = attachPointerRotation(controls, center)
  rotations.set(controls, rotation)
  return { surface, controls, camera, rotation, dispose: () => { rotation.dispose(); controls.dispose() } }
}

function drag(surface: InputSurface, input: 'mouse' | 'touch', dx: number, dy: number, x = 100, y = 100) {
  surface.dispatchEvent(pointer('pointerdown', input, x, y))
  for (let step = 1; step <= 10; step++) surface.ownerDocument.dispatchEvent(pointer('pointermove', input, x + dx * step / 10, y + dy * step / 10))
  surface.ownerDocument.dispatchEvent(pointer('pointerup', input, x + dx, y + dy))
}

describe('rotation follows the grabbed end', () => {
  it.each(['mouse', 'touch'] as const)('raises either grabbed end when dragging up with %s', input => {
    for (const side of [-1, 1]) {
      const { surface, controls, camera, dispose } = setup(390)
      try {
        const end = new Vector3(side * 120, 0, 0)
        drag(surface, input, 0, -50, 195 + side * 120, 195)
        settle(controls)
        expect(projected(camera, end).y).toBeGreaterThan(0.05)
        expect(projected(camera, end.clone().negate()).y).toBeLessThan(-0.05)
      } finally { dispose() }
    }
  })

  it.each(['mouse', 'touch'] as const)('uses the panned bat center rather than the canvas center with %s', input => {
    const { surface, controls, camera, dispose } = setup(390)
    const detach = attachCenteredOrbit(controls, new Vector3(), 390, 390)
    try {
      pan(surface, input, 150, 0)
      settle(controls)
      const centerX = (projected(camera, new Vector3()).x + 1) * 195
      const grabX = centerX - 100
      expect(grabX).toBeGreaterThan(195)
      drag(surface, input, 0, -50, grabX, 195)
      settle(controls)
      expect(projected(camera, new Vector3(-120, 0, 0)).y).toBeGreaterThan(0.05)
      expect((projected(camera, new Vector3()).x + 1) * 195).toBeCloseTo(centerX, 7)
    } finally { detach(); dispose() }
  })

  it('crosses the center smoothly and can retrace a gesture', () => {
    const { surface, controls, camera, dispose } = setup(390)
    try {
      const initial = camera.quaternion.clone()
      surface.dispatchEvent(pointer('pointerdown', 'mouse', 75, 195))
      let previous = initial.clone()
      for (let x = 76; x <= 315; x++) {
        surface.ownerDocument.dispatchEvent(pointer('pointermove', 'mouse', x, 175))
        controls.update()
        rotations.get(controls)!.update()
        expect(camera.quaternion.angleTo(previous)).toBeLessThan(0.03)
        previous.copy(camera.quaternion)
      }
      surface.ownerDocument.dispatchEvent(pointer('pointermove', 'mouse', 75, 195))
      surface.ownerDocument.dispatchEvent(pointer('pointerup', 'mouse', 75, 195))
      settle(controls)
      expect(camera.quaternion.angleTo(initial)).toBeLessThan(1e-7)
    } finally { dispose() }
  })

  it('uses viewport coordinates when the preview is offset within the page', () => {
    const { surface, controls, camera, dispose } = setup(390)
    try {
      surface.left = 520
      surface.top = 232
      drag(surface, 'mouse', 0, -50, surface.left + 75, surface.top + 195)
      settle(controls)
      expect(projected(camera, new Vector3(-120, 0, 0)).y).toBeGreaterThan(0.05)
    } finally { dispose() }
  })

  it('finishes damping and stops requesting frames', () => {
    const { surface, controls, rotation, dispose } = setup(390)
    try {
      drag(surface, 'mouse', 0, -50, 75, 195)
      settle(controls)
      let changes = 0
      const change = () => { changes++ }
      controls.addEventListener('change', change)
      for (let frame = 0; frame < 60; frame++) rotation.update()
      expect(changes).toBe(0)
      controls.removeEventListener('change', change)
    } finally { dispose() }
  })

  it('still turns out of the screen plane in both directions near the center', () => {
    for (const [dx, dy, component] of [[100, 0, 'x'], [0, 100, 'y']] as const) {
      const { surface, controls, camera, dispose } = setup(390)
      try {
        drag(surface, 'mouse', dx, dy, 195, 195)
        settle(controls)
        expect(Math.abs(camera.position[component])).toBeGreaterThan(500)
        expect(camera.position.length()).toBeCloseTo(1200, 7)
      } finally { dispose() }
    }
  })

  it('resumes single-finger rotation after two-finger panning without jumping', () => {
    const { surface, controls, camera, dispose } = setup(390)
    const detach = attachCenteredOrbit(controls, new Vector3(), 390, 390)
    try {
      surface.dispatchEvent(pointer('pointerdown', 'touch', 75, 195, 0, 1))
      surface.dispatchEvent(pointer('pointerdown', 'touch', 315, 195, 0, 2))
      surface.ownerDocument.dispatchEvent(pointer('pointermove', 'touch', 95, 195, 0, 1))
      surface.ownerDocument.dispatchEvent(pointer('pointermove', 'touch', 335, 195, 0, 2))
      settle(controls)
      const before = camera.quaternion.clone()
      const center = projected(camera, new Vector3())
      surface.ownerDocument.dispatchEvent(pointer('pointerup', 'touch', 335, 195, 0, 2))
      settle(controls)
      expect(camera.quaternion.angleTo(before)).toBeLessThan(1e-7)
      expect(projected(camera, new Vector3()).distanceTo(center)).toBeLessThan(1e-7)
      surface.ownerDocument.dispatchEvent(pointer('pointermove', 'touch', 95, 145, 0, 1))
      surface.ownerDocument.dispatchEvent(pointer('pointerup', 'touch', 95, 145, 0, 1))
      settle(controls)
      expect(projected(camera, new Vector3(-120, 0, 0)).y).toBeGreaterThan(0.05)
      expect(projected(camera, new Vector3()).distanceTo(center)).toBeLessThan(1e-7)
    } finally { detach(); dispose() }
  })

  it.each(['cancel', 'dispose', 'disable'] as const)('stops pending rotation on %s', action => {
    const { surface, controls, camera, rotation, dispose } = setup(390)
    try {
      surface.dispatchEvent(pointer('pointerdown', 'touch', 75, 195))
      surface.ownerDocument.dispatchEvent(pointer('pointermove', 'touch', 75, 145))
      if (action === 'cancel') surface.ownerDocument.dispatchEvent(pointer('pointercancel', 'touch', 75, 145))
      if (action === 'dispose') rotation.dispose()
      if (action === 'disable') controls.enabled = false
      const stopped = camera.quaternion.clone()
      surface.ownerDocument.dispatchEvent(pointer('pointermove', 'touch', 75, 100))
      settle(controls)
      expect(camera.quaternion.angleTo(stopped)).toBeLessThan(1e-7)
    } finally { dispose() }
  })

  it('ignores modifier-left, right and middle rotation input and zero-sized surfaces', () => {
    for (const button of [0, 1, 2]) {
      const { surface, controls, camera, dispose } = setup(390)
      try {
        const before = camera.quaternion.clone()
        const event = pointer('pointerdown', 'mouse', 75, 195, button)
        surface.dispatchEvent(Object.assign(event, { ctrlKey: button === 0 }))
        surface.ownerDocument.dispatchEvent(pointer('pointermove', 'mouse', 75, 145, button))
        surface.ownerDocument.dispatchEvent(pointer('pointerup', 'mouse', 75, 145, button))
        settle(controls)
        expect(camera.quaternion.angleTo(before)).toBeLessThan(1e-7)
      } finally { dispose() }
    }
    const { surface, controls, camera, dispose } = setup(0)
    try {
      const before = camera.quaternion.clone()
      drag(surface, 'mouse', 100, 0)
      settle(controls)
      expect(camera.quaternion.angleTo(before)).toBeLessThan(1e-7)
    } finally { dispose() }
  })
})

describe('rotation follows pixel distance independently of preview height', () => {
  it.each(['mouse', 'touch'] as const)('rotates 30 degrees per 100 pixels with %s in tall and short canvases', input => {
    for (const height of [290, 359, 420, 563, 720]) {
      const { surface, controls, camera, dispose } = setup(height)
      try {
        const before = camera.quaternion.clone()
        drag(surface, input, 100, 0)
        const released = camera.quaternion.angleTo(before)
        expect(released).toBeGreaterThan(0)
        expect(released).toBeLessThan(Math.PI / 6)
        settle(controls)
        expect(camera.quaternion.angleTo(before)).toBeCloseTo(Math.PI / 6, 8)
        const settled = camera.quaternion.clone()
        settle(controls)
        expect(camera.quaternion.angleTo(settled)).toBeLessThan(1e-7)
        expect(controls.panSpeed).toBe(1)
        expect(controls.zoomSpeed).toBe(1)
      } finally { dispose() }
    }
  })

  it('keeps vertical sensitivity after resizing and preserves a short damped finish', () => {
    const { surface, controls, camera, rotation, dispose } = setup(320)
    try {
      const before = camera.quaternion.clone()
      drag(surface, 'mouse', 0, 50)
      settle(controls)
      const first = camera.quaternion.clone()
      expect(first.angleTo(before)).toBeCloseTo(Math.PI / 12, 8)
      rotation.dispose()
      surface.clientHeight = 700
      const resized = attachPointerRotation(controls, new Vector3())
      rotations.set(controls, resized)
      drag(surface, 'touch', 0, 50)
      settle(controls)
      expect(camera.quaternion.angleTo(first)).toBeCloseTo(Math.PI / 12, 8)
      resized.dispose()
    } finally { dispose() }
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
  for (let frame = 0; frame < 300; frame++) {
    controls.update()
    rotations.get(controls)?.update()
  }
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

describe('shared preview framing and mode transitions', () => {
  it.each(['mouse', 'touch'] as const)('preserves the whole screen through mode switches after %s pan, rotation and zoom', input => {
    const anchor = new Vector3(-30, 0, 0)
    const { surface, controls, camera, rotation, dispose } = setup(390, anchor)
    const detach = attachCenteredOrbit(controls, anchor, 390, 390)
    const view = createPreviewView(controls, anchor, rotation.cancel)
    const area = { width: 390, height: 390, hintTop: 348 }
    const trimmed = { center: new Vector3(-30, 0, 0), radius: 350 }
    const whole = { center: new Vector3(20, 0, 0), radius: 500 }
    try {
      expect(view.update(trimmed, 500, area, 0)).toBe(true)
      pan(surface, input, 40, 30)
      settle(controls)
      drag(surface, input, 75, -20)
      settle(controls)
      zoom(surface, input)
      settle(controls)
      const landmarks = [new Vector3(-100, 0, 0), new Vector3(150, 20, 10)]
      const before = landmarks.map(point => projected(camera, point))
      const angle = camera.quaternion.clone()
      const beforeZoom = camera.zoom
      for (const mode of [whole, trimmed, whole]) {
        expect(view.update(mode, 500, area, 0)).toBe(false)
        settle(controls)
        expect(camera.zoom).toBe(beforeZoom)
        expect(camera.quaternion.angleTo(angle)).toBeLessThan(1e-7)
        landmarks.forEach((point, index) => {
          const after = projected(camera, point)
          expect(Math.hypot(after.x - before[index].x, after.y - before[index].y)).toBeLessThan(1e-7)
        })
      }
      const pivot = projected(camera, whole.center)
      drag(surface, input, 50, 30)
      settle(controls)
      expect(projected(camera, whole.center).distanceTo(pivot)).toBeLessThan(1e-7)
      const resetAngle = camera.quaternion.clone()
      expect(view.update(whole, 500, area, 1)).toBe(true)
      settle(controls)
      expect(camera.quaternion.angleTo(resetAngle)).toBeLessThan(1e-7)
      expect((projected(camera, whole.center).x + 1) * 195).toBeCloseTo(195, 7)
      expect((1 - projected(camera, whole.center).y) * 195).toBeCloseTo(174, 7)
      expect(camera.zoom).toBeCloseTo(348 * 0.96 / 1000, 8)
    } finally { detach(); dispose() }
  })

  it.each(['pan', 'rotate'] as const)('resets immediately during pending %s motion and stays put afterward', action => {
    const anchor = new Vector3()
    const { surface, controls, camera, rotation, dispose } = setup(390, anchor)
    const detach = attachCenteredOrbit(controls, anchor, 390, 390)
    const view = createPreviewView(controls, anchor, rotation.cancel)
    const frame = { center: new Vector3(), radius: 450 }
    const area = { width: 390, height: 390, hintTop: 348 }
    try {
      view.update(frame, 450, area, 0)
      if (action === 'pan') pan(surface, 'mouse', 60, 30)
      else drag(surface, 'touch', 80, 30)
      const angle = camera.quaternion.clone()
      view.update(frame, 450, area, 1)
      const reset = projected(camera, anchor)
      settle(controls)
      expect(camera.quaternion.angleTo(angle)).toBeLessThan(1e-7)
      expect(projected(camera, anchor).distanceTo(reset)).toBeLessThan(1e-7)
      expect((1 - reset.y) * 195).toBeCloseTo(174, 7)
      const beforeDrag = camera.quaternion.clone()
      drag(surface, 'mouse', 50, -10)
      settle(controls)
      expect(camera.quaternion.angleTo(beforeDrag)).toBeGreaterThan(0.1)
      expect(projected(camera, anchor).distanceTo(reset)).toBeLessThan(1e-7)
    } finally { detach(); dispose() }
  })

  it('refits a changed canvas or wrapped hint while preserving the current angle', () => {
    const anchor = new Vector3()
    const { surface, controls, camera, rotation, dispose } = setup(390, anchor)
    let detach = attachCenteredOrbit(controls, anchor, 390, 390)
    const view = createPreviewView(controls, anchor, rotation.cancel)
    const frame = { center: new Vector3(), radius: 450 }
    try {
      view.update(frame, 450, { width: 390, height: 390, hintTop: 348 }, 0)
      drag(surface, 'mouse', 80, 40)
      settle(controls)
      pan(surface, 'mouse', 40, 30)
      settle(controls)
      const angle = camera.quaternion.clone()
      detach()
      surface.clientWidth = 800
      surface.clientHeight = 450
      camera.left = -400
      camera.right = 400
      camera.top = 225
      camera.bottom = -225
      camera.updateProjectionMatrix()
      detach = attachCenteredOrbit(controls, anchor, 800, 450)
      expect(view.update(frame, 450, { width: 800, height: 450, hintTop: 410 }, 0)).toBe(true)
      settle(controls)
      expect(camera.quaternion.angleTo(angle)).toBeLessThan(1e-7)
      expect(camera.zoom).toBeCloseTo(410 * 0.96 / 900, 8)
      expect((1 - projected(camera, anchor).y) * 225).toBeCloseTo(205, 7)
      expect(view.update(frame, 450, { width: 800, height: 450, hintTop: 380 }, 0)).toBe(true)
      expect(camera.zoom).toBeCloseTo(380 * 0.96 / 900, 8)
      expect((1 - projected(camera, anchor).y) * 225).toBeCloseTo(190, 7)
    } finally { detach(); dispose() }
  })

  it('restores fitted centering after a subpixel camera-size update recreates the pan adapter', () => {
    const anchor = new Vector3()
    const { controls, camera, rotation, dispose } = setup(390, anchor)
    let detach = attachCenteredOrbit(controls, anchor, 390, 390)
    const view = createPreviewView(controls, anchor, rotation.cancel)
    const frame = { center: new Vector3(), radius: 450 }
    try {
      view.update(frame, 450, { width: 390, height: 390, hintTop: 348 }, 0)
      detach()
      const cameraWidth = 390.00001
      camera.left = -cameraWidth / 2
      camera.right = cameraWidth / 2
      camera.updateProjectionMatrix()
      detach = attachCenteredOrbit(controls, anchor, cameraWidth, 390)
      expect(view.update(frame, 450, { width: cameraWidth, height: 390, hintTop: 348 }, 0)).toBe(true)
      expect((1 - projected(camera, anchor).y) * 195).toBeCloseTo(174, 7)
    } finally { detach(); dispose() }
  })
})

describe('rotation around the displayed bat after panning', () => {
  it.each(['mouse', 'touch'] as const)('keeps the panned screen position through %s rotation and zoom', input => {
    for (const height of [320, 700]) {
      const center = new Vector3(15, 0, 0)
      const { surface, controls, camera, dispose } = setup(height, center)
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
      } finally { detach(); dispose() }
    }
  })

  it('does not jump when rotation starts with a target away from the displayed center', () => {
    const center = new Vector3(25, 10, 0)
    const { surface, controls, camera, dispose } = setup(390, center)
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
    } finally { detach(); dispose() }
  })

  it('clears screen panning and listeners before reframing a new center or canvas size', () => {
    const { surface, controls, camera, rotation, dispose } = setup(390)
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
    rotation.dispose()
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
    const nextRotation = attachPointerRotation(controls, nextCenter)
    rotations.set(controls, nextRotation)
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
    } finally { nextRotation.dispose(); detachNext(); dispose() }
  })
})
