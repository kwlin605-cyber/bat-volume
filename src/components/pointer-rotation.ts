import { MathUtils, Quaternion, Vector2, Vector3 } from 'three'
import type { OrbitControls } from 'three-stdlib'
import { previewInteraction } from '../config/preview'

// A smooth front hemisphere gives the grabbed side influence without a center seam.
function onHemisphere(point: Vector2, center: Vector2, radius: number) {
  return new Vector3((point.x - center.x) / radius, (center.y - point.y) / radius, 1).normalize()
}

export function attachPointerRotation(controls: OrbitControls, center: Vector3) {
  if (!controls.domElement) throw new Error('Pointer rotation requires connected controls')
  const surface = controls.domElement
  const document = surface.ownerDocument
  const camera = controls.object
  const touches = new Map<number, Vector2>()
  const screenCenter = new Vector2()
  const startPoint = new Vector2()
  const startEye = new Vector3()
  const startUp = new Vector3()
  const startOrientation = new Quaternion()
  const current = new Quaternion()
  const goal = new Quaternion()
  const axis = new Vector3()
  const worldRotation = new Quaternion()
  let radius = 0
  let rotatingPointer: number | null = null
  let pending = false

  function stop() {
    if (rotatingPointer !== null) controls.dispatchEvent({ type: 'end', target: controls })
    rotatingPointer = null
    pending = false
  }

  function begin(pointerId: number, point: Vector2) {
    stop()
    const bounds = surface.getBoundingClientRect()
    radius = Math.min(bounds.width, bounds.height) / 2
    if (!controls.enabled || radius <= 0) return
    // Bounds and the panning adapter must finish rebasing before capturing the pose.
    controls.dispatchEvent({ type: 'start', target: controls })
    camera.updateMatrixWorld()
    const projected = center.clone().project(camera)
    screenCenter.set(bounds.left + (projected.x + 1) * bounds.width / 2, bounds.top + (1 - projected.y) * bounds.height / 2)
    startPoint.copy(point)
    startEye.subVectors(camera.position, center)
    startUp.copy(camera.up)
    startOrientation.copy(camera.quaternion)
    current.identity()
    goal.identity()
    rotatingPointer = pointerId
  }

  function down(event: PointerEvent) {
    if (event.pointerType === 'touch') {
      touches.set(event.pointerId, new Vector2(event.clientX, event.clientY))
      if (touches.size === 1) begin(event.pointerId, touches.get(event.pointerId)!)
      else stop()
    } else if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      begin(event.pointerId, new Vector2(event.clientX, event.clientY))
    } else stop()
  }

  function move(event: PointerEvent) {
    const point = new Vector2(event.clientX, event.clientY)
    if (touches.has(event.pointerId)) touches.set(event.pointerId, point)
    if (event.pointerId !== rotatingPointer) return
    if (!controls.enabled || event.ctrlKey || event.metaKey || event.shiftKey) { stop(); return }
    axis.crossVectors(onHemisphere(startPoint, screenCenter, radius), onHemisphere(point, screenCenter, radius))
    const angle = MathUtils.degToRad(startPoint.distanceTo(point) * previewInteraction.rotationDegreesPerPixel)
    if (axis.lengthSq() === 0) goal.identity()
    else goal.setFromAxisAngle(axis.normalize(), angle)
    pending = true
    update()
  }

  function up(event: PointerEvent) {
    const wasTouch = touches.delete(event.pointerId)
    if (event.pointerId === rotatingPointer) {
      rotatingPointer = null
      controls.dispatchEvent({ type: 'end', target: controls })
    }
    if (wasTouch && touches.size === 1) {
      const [id, point] = touches.entries().next().value!
      begin(id, point)
    }
  }

  function cancel() { touches.clear(); stop() }

  function update() {
    if (!pending) return
    if (!controls.enabled) { stop(); return }
    current.slerp(goal, controls.enableDamping ? previewInteraction.dampingFactor : 1)
    if (current.angleTo(goal) <= previewInteraction.rotationSettleAngleRadians) {
      current.copy(goal)
      pending = false
    }
    // Rotate the camera oppositely so the model follows the pointer, including roll.
    worldRotation.copy(startOrientation).multiply(current.clone().invert()).multiply(startOrientation.clone().invert())
    camera.position.copy(startEye).applyQuaternion(worldRotation).add(center)
    camera.up.copy(startUp).applyQuaternion(worldRotation)
    camera.lookAt(center)
    camera.updateMatrixWorld()
    controls.dispatchEvent({ type: 'change', target: controls })
  }

  surface.addEventListener('pointerdown', down)
  surface.addEventListener('wheel', stop)
  document.addEventListener('pointermove', move)
  document.addEventListener('pointerup', up)
  document.addEventListener('pointercancel', cancel)
  document.defaultView?.addEventListener('blur', cancel)
  return {
    update,
    cancel,
    dispose() {
      cancel()
      surface.removeEventListener('pointerdown', down)
      surface.removeEventListener('wheel', stop)
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
      document.removeEventListener('pointercancel', cancel)
      document.defaultView?.removeEventListener('blur', cancel)
    },
  }
}
