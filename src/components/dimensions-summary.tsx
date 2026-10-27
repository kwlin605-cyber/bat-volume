import type { BatDimensions } from '../domain/types'
import { gripDiagnosticText, text } from '../i18n/zh-TW'
import { lengthDisplay } from '../lib/length-display'
import { formatDimension } from '../lib/format'
import { defaultDiameterAllowanceMm, finishedDiameter } from '../domain/diameter-allowance'

export function DimensionsSummary({ dimensions, diameterAllowanceMm = defaultDiameterAllowanceMm }: { dimensions: BatDimensions; diameterAllowanceMm?: number }) {
  const grip = dimensions.grip
  const measurements = [
    { key: 'retained-length', label: text.retainedLength, value: dimensions.lengthMm, unit: text.centimetreUnit, format: (mm: number) => lengthDisplay(mm, 'cm').display },
    { key: 'maximum-diameter', label: text.maximumDiameter, value: finishedDiameter(dimensions.maximumDiameterMm, diameterAllowanceMm), unit: text.millimetreUnit, format: formatDimension },
    { key: 'minimum-grip-diameter', label: text.minimumGripDiameter, value: finishedDiameter(grip.status === 'detected' ? grip.diameterMm : null, diameterAllowanceMm), unit: text.millimetreUnit, format: formatDimension },
  ]
  return <dl className="dimensions-summary" aria-label={text.dimensions}>
    {measurements.map(measurement => <div key={measurement.key}>
      <dt>{measurement.label}</dt>
      <dd data-testid={measurement.key}>
        {measurement.value === null ? <span className="dimension-unavailable" title={measurement.key === 'minimum-grip-diameter' && grip.status === 'undetermined' ? gripDiagnosticText[grip.code] : undefined}>{text.missingValue}</span> : <><span>{measurement.format(measurement.value)}</span><span className="dimension-unit">{measurement.unit}</span></>}
      </dd>
    </div>)}
  </dl>
}
