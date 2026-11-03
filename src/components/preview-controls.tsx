import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef } from 'react'
import type { Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { previewInteraction } from '../config/preview'
import { attachCenteredOrbit } from './centered-orbit'
import { attachPointerRotation } from './pointer-rotation'

export function PreviewControls({ center }: { center: Vector3 }) {
  const { width, height } = useThree(state => state.size)
  const controls = useRef<OrbitControlsImpl>(null)
  const rotation = useRef<ReturnType<typeof attachPointerRotation> | null>(null)
  useLayoutEffect(() => {
    if (controls.current) return attachCenteredOrbit(controls.current, center, width, height)
  }, [center, width, height])
  useEffect(() => {
    if (!controls.current) return
    const controller = attachPointerRotation(controls.current, center)
    rotation.current = controller
    return () => { controller.dispose(); rotation.current = null }
  }, [center, width, height])
  useFrame(() => rotation.current?.update())
  return <OrbitControls ref={controls} makeDefault enablePan enableZoom enableRotate={false} screenSpacePanning
    enableDamping dampingFactor={previewInteraction.dampingFactor}
    minDistance={60} maxDistance={12000} />
}
