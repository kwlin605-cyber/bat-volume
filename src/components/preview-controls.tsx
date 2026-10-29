import { OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { previewInteraction } from '../config/preview'

export function rotationSpeedForHeight(height: number) {
  // OrbitControls divides drag distance by element height; cancel that scaling.
  return Math.max(0, height) * previewInteraction.rotationDegreesPerPixel / 360
}

export function PreviewControls() {
  const height = useThree(state => state.size.height)
  return <OrbitControls makeDefault enablePan enableZoom enableRotate screenSpacePanning
    enableDamping dampingFactor={previewInteraction.dampingFactor}
    rotateSpeed={rotationSpeedForHeight(Math.round(height))}
    minDistance={60} maxDistance={12000} />
}
