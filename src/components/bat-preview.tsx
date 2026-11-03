import { previewColors } from '../config/theme'
import { previewGeometry } from '../config/preview'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { BufferGeometry, Line, LineDashedMaterial, Vector3 } from 'three'
import { LoaderCircle, Scan } from 'lucide-react'
import type { AnalysisResult, ProfilePoint } from '../domain/types'
import { text } from '../i18n/zh-TW'
import { SectionMarker } from './section-marker'
import { createBatGeometry } from './bat-geometry'
import { PreviewControls } from './preview-controls'
import type { PreviewMode } from './preview-mode'
import { previewFrame, type PreviewArea } from './preview-framing'
import { Button } from './ui/button'

function CutRing({ y }: { y: number }) {
  const line = useMemo(() => {
    const geometry = new BufferGeometry().setFromPoints(Array.from({ length: 129 }, (_, index) => {
      const angle = index / 128 * Math.PI * 2
      return new Vector3(Math.cos(angle) * previewGeometry.cutRadius, y, Math.sin(angle) * previewGeometry.cutRadius)
    }))
    const value = new Line(geometry, new LineDashedMaterial({ color: previewColors.cut, dashSize: 2.8, gapSize: 2.3 }))
    value.computeLineDistances()
    return value
  }, [y])
  useEffect(() => () => { line.geometry.dispose(); line.material.dispose() }, [line])
  return <primitive object={line} />
}

function BatMesh({ points, center }: { points: ProfilePoint[]; center: number }) {
  const geometry = useMemo(() => createBatGeometry(points, center), [points, center])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry}><meshStandardMaterial color={previewColors.wood} roughness={0.58} metalness={0} /></mesh>
}

export default function BatPreview({ result, mode: requestedMode, interactionHelp = text.orbitHelp }: { result: AnalysisResult; mode: PreviewMode; interactionHelp?: string }) {
  const panel = useRef<HTMLElement>(null)
  const hint = useRef<HTMLSpanElement>(null)
  const [area, setArea] = useState<PreviewArea | null>(null)
  const [ready, setReady] = useState(false)
  const [resetRevision, setResetRevision] = useState(0)
  const markReady = useCallback(() => setReady(true), [])
  useLayoutEffect(() => {
    const element = panel.current
    const label = hint.current
    if (!element || !label) return
    const measure = () => {
      const rect = element.getBoundingClientRect()
      const hintRect = label.getBoundingClientRect()
      const next = { width: rect.width, height: rect.height, hintTop: hintRect.top - rect.top }
      setArea(before => before?.width === next.width && before.height === next.height && before.hintTop === next.hintTop ? before : next)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    observer.observe(label)
    measure()
    return () => observer.disconnect()
  }, [])
  const calculated = result.status === 'calculated'
  const mode = calculated ? requestedMode : 'whole'
  const profile = result.profile!
  const points = calculated && mode === 'trimmed' ? result.retained : profile.points
  const center = (profile.range.low + profile.range.high) / 2
  const cuts = calculated ? result.cuts : result.partial
  const showCuts = mode === 'whole' && (cuts?.low !== undefined || cuts?.high !== undefined)
  const mass = calculated ? result.massProperties : null
  const frames = useMemo(() => {
    const markers = calculated ? [
      result.dimensions.maximum,
      ...(result.dimensions.grip.status === 'detected' ? [result.dimensions.grip.minimum] : []),
      ...(mass ? [mass.center] : []),
    ] : []
    const rings = markers.map(point => ({ y: point.y, radius: point.radius + previewGeometry.markerOffset }))
    const cutRings = [cuts?.low, cuts?.high].filter((y): y is number => y !== undefined).map(y => ({ y, radius: previewGeometry.cutRadius }))
    const whole = previewFrame(profile.points, center, rings.concat(cutRings))
    const trimmed = calculated ? previewFrame(result.retained, center, rings) : whole
    return { whole, trimmed, sceneRadius: Math.max(whole.radius, trimmed.radius) }
  }, [result, calculated, profile, center, cuts, mass])
  return <section ref={panel} className="preview-panel" aria-label={text.previewDescription}>
    <div className={`canvas-wrap${ready ? '' : ' preview-canvas-loading'}`} data-testid="desktop-preview">
      <Canvas orthographic camera={{ position: [0, 80, 1200], zoom: 1, near: 0.1, far: 20000 }} dpr={[1, 2]} frameloop="demand" aria-label={text.previewDescription}>
        <ambientLight intensity={1.15} />
        <directionalLight position={[-250, 450, 650]} intensity={2.1} />
        <directionalLight position={[300, -150, -400]} intensity={0.9} />
        <group rotation={[0, 0, Math.PI / 2]}>
          <BatMesh points={points} center={center} />
          {showCuts && cuts?.low !== undefined && <CutRing y={cuts.low - center} />}
          {showCuts && cuts?.high !== undefined && <CutRing y={cuts.high - center} />}
          {calculated && <SectionMarker point={result.dimensions.maximum} center={center} kind="maximum" />}
          {calculated && result.dimensions.grip.status === 'detected' && <SectionMarker point={result.dimensions.grip.minimum} center={center} kind="grip" />}
          {mass && <SectionMarker point={mass.center} center={center} kind="balance" />}
        </group>
        <PreviewControls frame={frames[mode]} sceneRadius={frames.sceneRadius} area={area} resetRevision={resetRevision} onReady={markReady} />
      </Canvas>
    </div>
    {!ready && <div className="preview-fallback preview-loading"><LoaderCircle className="spin" size={18} />{text.previewLoading}</div>}
    <div className="preview-footer">
      <span ref={hint}>{interactionHelp}</span>
      <Button className="preview-reset" variant="outline" size="icon" disabled={!ready} title={text.previewResetSize} aria-label={text.previewResetSize} onClick={() => setResetRevision(value => value + 1)}><Scan /></Button>
    </div>
  </section>
}
