import { OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import type { Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { previewInteraction } from '../config/preview'
import { attachCenteredOrbit } from './centered-orbit'

export function rotationSpeedForHeight(height: number) {
  // OrbitControls divides drag distance by element height; cancel that scaling.
  return Math.max(0, height) * previewInteraction.rotationDegreesPerPixel / 360
}

export function PreviewControls({ center }: { center: Vector3 }) {
  const { width, height } = useThree(state => state.size)
  const controls = useRef<OrbitControlsImpl>(null)
  useLayoutEffect(() => {
    if (controls.current) return attachCenteredOrbit(controls.current, center, width, height)
  }, [center, width, height])
  return <OrbitControls ref={controls} makeDefault enablePan enableZoom enableRotate screenSpacePanning
    enableDamping dampingFactor={previewInteraction.dampingFactor}
    rotateSpeed={rotationSpeedForHeight(Math.round(height))}
    minDistance={60} maxDistance={12000} />
}
