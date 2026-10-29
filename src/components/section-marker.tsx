import { previewColors } from '../config/theme'
import { useEffect, useMemo } from 'react'
import { BufferGeometry, Line, LineBasicMaterial, Vector3 } from 'three'
import type { ProfilePoint } from '../domain/types'

export function SectionMarker({ point, center, kind }: { point: ProfilePoint; center: number; kind: 'maximum' | 'grip' }) {
  const color = previewColors[kind]
  const y = point.y - center
  const ring = useMemo(() => {
    const radius = point.radius + 0.8
    const geometry = new BufferGeometry().setFromPoints(Array.from({ length: 97 }, (_, index) => {
      const angle = index / 96 * Math.PI * 2
      return new Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius)
    }))
    return new Line(geometry, new LineBasicMaterial({ color, transparent: true, opacity: 0.85, depthTest: false }))
  }, [point.radius, y, color])
  useEffect(() => () => { ring.geometry.dispose(); ring.material.dispose() }, [ring])
  return <primitive object={ring} renderOrder={3} />
}
