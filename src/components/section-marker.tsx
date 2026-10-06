import { useEffect, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferGeometry, Line, LineBasicMaterial, Vector3 } from 'three'
import type { Group } from 'three'
import type { ProfilePoint } from '../domain/types'

export function SectionMarker({ point, center, labelRef, kind }: { point: ProfilePoint; center: number; labelRef: RefObject<HTMLSpanElement | null>; kind: 'maximum' | 'grip' }) {
  const color = kind === 'maximum' ? '#567c9a' : '#4f8974'
  const y = point.y - center
  const group = useRef<Group>(null)
  const anchor = useMemo(() => new Vector3(), [])
  const ring = useMemo(() => {
    const radius = point.radius + 0.8
    const geometry = new BufferGeometry().setFromPoints(Array.from({ length: 97 }, (_, index) => {
      const angle = index / 96 * Math.PI * 2
      return new Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius)
    }))
    return new Line(geometry, new LineBasicMaterial({ color, transparent: true, opacity: 0.85, depthTest: false }))
  }, [point.radius, y, color])
  useEffect(() => () => { ring.geometry.dispose(); ring.material.dispose() }, [ring])
  useFrame(({ camera, size }) => {
    const label = labelRef.current
    if (!label || !group.current) return
    group.current.updateWorldMatrix(true, false)
    anchor.set(point.radius + 25, y, 0).applyMatrix4(group.current.matrixWorld).project(camera)
    label.style.visibility = anchor.z >= -1 && anchor.z <= 1 ? 'visible' : 'hidden'
    label.style.transform = `translate(${(anchor.x + 1) * size.width / 2}px, ${(1 - anchor.y) * size.height / 2}px) translate(-50%, -50%)`
  })
  return <group ref={group}>
    <primitive object={ring} renderOrder={3} />
  </group>
}
