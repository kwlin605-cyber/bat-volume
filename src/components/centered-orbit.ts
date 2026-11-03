import { OrthographicCamera, Vector3 } from 'three'
import type { OrbitControls } from 'three-stdlib'

export function attachCenteredOrbit(controls: OrbitControls, center: Vector3, width: number, height: number) {
  const object = controls.object
  if (!(object instanceof OrthographicCamera)) throw new Error('Centered preview requires an orthographic camera')
  const camera = object
  // Ignore setup changes until an input or the view controller establishes the pivot.
  let active = false
  const delta = new Vector3()
  const right = new Vector3()
  const up = new Vector3()

  function preserveCenter() {
    if (!active || width <= 0 || height <= 0) return
    delta.subVectors(controls.target, center)
    if (delta.lengthSq() === 0) return
    camera.updateMatrixWorld()
    right.setFromMatrixColumn(camera.matrixWorld, 0)
    up.setFromMatrixColumn(camera.matrixWorld, 1)
    // Keep panning in screen pixels while the orbit target stays on the bat.
    const offsetX = (camera.view?.enabled ? camera.view.offsetX : 0) + delta.dot(right) * camera.zoom * width / (camera.right - camera.left)
    const offsetY = (camera.view?.enabled ? camera.view.offsetY : 0) - delta.dot(up) * camera.zoom * height / (camera.top - camera.bottom)
    camera.position.sub(delta)
    controls.target.copy(center)
    camera.setViewOffset(width, height, offsetX, offsetY, width, height)
    camera.updateMatrixWorld()
  }

  function start() {
    active = true
    preserveCenter()
  }

  controls.addEventListener('start', start)
  controls.addEventListener('change', preserveCenter)
  return () => {
    controls.removeEventListener('start', start)
    controls.removeEventListener('change', preserveCenter)
    camera.clearViewOffset()
  }
}
