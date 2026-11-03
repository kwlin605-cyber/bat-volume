import { OrthographicCamera, type Vector3 } from 'three'
import type { OrbitControls } from 'three-stdlib'
import { previewFraming } from '../config/preview'
import { fitPreview, type PreviewArea, type PreviewFrame } from './preview-framing'

export function createPreviewView(control: OrbitControls, anchor: Vector3, cancelRotation: () => void) {
  const camera = control.object
  if (!(camera instanceof OrthographicCamera)) throw new Error('Preview framing requires an orthographic camera')
  let previousFrame: PreviewFrame | null = null
  let previousFit: (PreviewArea & { revision: number }) | null = null

  return {
    update(frame: PreviewFrame, sceneRadius: number, area: PreviewArea, revision: number) {
      if (previousFrame !== frame) {
        cancelRotation()
        // Rebasing the pivot preserves the projection of every existing model point.
        anchor.copy(frame.center)
        control.dispatchEvent({ type: 'start', target: control })
        previousFrame = frame
      }
      if (previousFit && previousFit.width === area.width && previousFit.height === area.height && previousFit.hintTop === area.hintTop && previousFit.revision === revision) return false
      cancelRotation()
      // Consume pending pan damping before replacing its position with the fitted view.
      const damping = control.enableDamping
      control.enableDamping = false
      control.update()
      control.enableDamping = damping
      control.target.copy(anchor)
      control.maxDistance = sceneRadius * previewFraming.cameraRadiusMultiplier * 2
      if (!fitPreview(camera, frame, area, sceneRadius)) return false
      previousFit = { ...area, revision }
      control.dispatchEvent({ type: 'change', target: control })
      return true
    },
  }
}
