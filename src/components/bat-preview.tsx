import { previewColors } from '../config/theme'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bounds, OrbitControls, useBounds } from '@react-three/drei'
import { BufferGeometry, Line, LineDashedMaterial, Vector3 } from 'three'
import type { AnalysisResult, ProfilePoint } from '../domain/types'
import { text } from '../i18n/zh-TW'
import { SectionMarker } from './section-marker'
import { createBatGeometry } from './bat-geometry'

function CutRing({ y }: { y: number }) {
  const line = useMemo(() => {
    const geometry = new BufferGeometry().setFromPoints(Array.from({ length: 129 }, (_, index) => {
      const angle = index / 128 * Math.PI * 2
      return new Vector3(Math.cos(angle) * 33, y, Math.sin(angle) * 33)
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

function FitView({ revision }: { revision: string }) {
  const bounds = useBounds()
  useEffect(() => { bounds.refresh().clip().fit() }, [bounds, revision])
  return null
}

export default function BatPreview({ result, interactionHelp = text.orbitHelp }: { result: AnalysisResult; interactionHelp?: string }) {
  const calculated = result.status === 'calculated'
  const [selectedMode, setMode] = useState<'whole' | 'trimmed'>(calculated ? 'trimmed' : 'whole')
  const mode = calculated ? selectedMode : 'whole'
  const maximumLabel = useRef<HTMLSpanElement>(null)
  const gripLabel = useRef<HTMLSpanElement>(null)
  const profile = result.profile!
  const points = calculated && mode === 'trimmed' ? result.retained : profile.points
  const center = (profile.range.low + profile.range.high) / 2
  const cuts = calculated ? result.cuts : result.partial
  const showCuts = mode === 'whole' && (cuts?.low !== undefined || cuts?.high !== undefined)
  const revision = `${result.source.name}:${mode}`
  return <section className="preview-panel" aria-label={text.previewDescription}>
    <div className="preview-toolbar">
      <div className="view-toggle" role="group" aria-label={text.previewTitle}>
        <button type="button" aria-pressed={mode === 'trimmed'} disabled={!calculated} onClick={() => setMode('trimmed')}>{text.trimmed}</button>
        <button type="button" aria-pressed={mode === 'whole'} onClick={() => setMode('whole')}>{text.whole}</button>
      </div>
    </div>
    <div className="canvas-wrap" data-testid="desktop-preview">
      <Canvas orthographic camera={{ position: [0, 80, 1200], zoom: 1, near: 0.1, far: 20000 }} dpr={[1, 2]} frameloop="demand" aria-label={text.previewDescription}>
        <ambientLight intensity={1.15} />
        <directionalLight position={[-250, 450, 650]} intensity={2.1} />
        <directionalLight position={[300, -150, -400]} intensity={0.9} />
        <Bounds fit clip observe margin={1.25}>
          <group rotation={[0, 0, Math.PI / 2]}>
            <BatMesh points={points} center={center} />
            {showCuts && cuts?.low !== undefined && <CutRing y={cuts.low - center} />}
            {showCuts && cuts?.high !== undefined && <CutRing y={cuts.high - center} />}
            {calculated && <SectionMarker point={result.dimensions.maximum} center={center} labelRef={maximumLabel} kind="maximum" />}
            {calculated && result.dimensions.grip.status === 'detected' && <SectionMarker point={result.dimensions.grip.minimum} center={center} labelRef={gripLabel} kind="grip" />}
          </group>
          <FitView revision={revision} />
        </Bounds>
        <OrbitControls makeDefault enablePan enableZoom enableRotate screenSpacePanning minDistance={60} maxDistance={12000} />
      </Canvas>
      {calculated && <span ref={maximumLabel} className="section-label section-label-maximum" data-testid="marker-maximum" data-y={result.dimensions.maximum.y} data-diameter={result.dimensions.maximumDiameterMm}>{text.maximumDiameter}</span>}
      {calculated && result.dimensions.grip.status === 'detected' && <span ref={gripLabel} className="section-label section-label-grip" data-testid="marker-grip" data-y={result.dimensions.grip.minimum.y} data-diameter={result.dimensions.grip.diameterMm}>{text.minimumGripDiameter}</span>}
    </div>
    <div className="preview-footer">{showCuts && <span>{text.linesLegend}</span>}<span>{interactionHelp}</span></div>
  </section>
}
