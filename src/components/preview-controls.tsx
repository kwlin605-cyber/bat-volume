import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { previewInteraction } from '../config/preview'
import { attachCenteredOrbit } from './centered-orbit'
import { attachPointerRotation } from './pointer-rotation'
import type { PreviewArea, PreviewFrame } from './preview-framing'
import { createPreviewView } from './preview-view'

export function PreviewControls({ frame, sceneRadius, area, resetRevision, onReady }: {
  frame: PreviewFrame; sceneRadius: number; area: PreviewArea | null; resetRevision: number; onReady: () => void
}) {
  const { width, height } = useThree(state => state.size)
  const controls = useRef<OrbitControlsImpl>(null)
  const rotation = useRef<ReturnType<typeof attachPointerRotation> | null>(null)
  const anchor = useMemo(() => frame.center.clone(), [])
  const view = useRef<ReturnType<typeof createPreviewView> | null>(null)
  useLayoutEffect(() => {
    if (controls.current) return attachCenteredOrbit(controls.current, anchor, width, height)
  }, [anchor, width, height])
  useLayoutEffect(() => {
    if (!controls.current) return
    view.current = createPreviewView(controls.current, anchor, () => rotation.current?.cancel())
    return () => { view.current = null }
  }, [anchor])
  useLayoutEffect(() => {
    if (!area || Math.abs(width - area.width) >= 1 || Math.abs(height - area.height) >= 1) return
    // A camera-size update also recreates the pan adapter, even at subpixel differences.
    if (view.current?.update(frame, sceneRadius, { width, height, hintTop: area.hintTop }, resetRevision)) onReady()
  }, [frame, sceneRadius, area, resetRevision, width, height, onReady])
  useEffect(() => {
    if (!controls.current) return
    const controller = attachPointerRotation(controls.current, anchor)
    rotation.current = controller
    return () => { controller.dispose(); rotation.current = null }
  }, [anchor, width, height])
  useFrame(() => rotation.current?.update())
  return <OrbitControls ref={controls} makeDefault enablePan enableZoom enableRotate={false} screenSpacePanning
    enableDamping dampingFactor={previewInteraction.dampingFactor} />
}
