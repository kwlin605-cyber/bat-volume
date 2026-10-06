import type { BatDimensions } from '../domain/types'
import { gripDiagnosticText, text } from '../i18n/zh-TW'
import { formatDimension } from '../lib/format'

export function DimensionsSummary({ dimensions }: { dimensions: BatDimensions }) {
  const grip = dimensions.grip
  const measurements = [
    { key: 'retained-length', label: text.retainedLength, value: dimensions.lengthMm },
    { key: 'maximum-diameter', label: text.maximumDiameter, value: dimensions.maximumDiameterMm },
    { key: 'minimum-grip-diameter', label: text.minimumGripDiameter, value: grip.status === 'detected' ? grip.diameterMm : null },
  ]
  return <dl className="dimensions-summary" aria-label={text.dimensions}>
    {measurements.map(measurement => <div key={measurement.key}>
      <dt>{measurement.label}</dt>
      <dd data-testid={measurement.key}>
        {measurement.value === null ? <span className="dimension-unavailable" title={grip.status === 'undetermined' ? gripDiagnosticText[grip.code] : undefined}>{text.unavailable}</span> : <><span>{formatDimension(measurement.value)}</span><span className="dimension-unit">{text.lengthUnit}</span></>}
      </dd>
    </div>)}
  </dl>
}
