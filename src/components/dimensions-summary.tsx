import type { BatDimensions } from '../domain/types'
import { gripDiagnosticText, text } from '../i18n/zh-TW'
import { lengthDisplay } from '../lib/length-display'
import { formatDimension } from '../lib/format'
import { measurementCaption } from '../lib/measurement-display'
import { MeasurementDistance } from './measurement-distance'

export function DimensionsSummary({ dimensions }: { dimensions: BatDimensions }) {
  const grip = dimensions.grip
  const measurements = [
    { key: 'retained-length', label: text.retainedLength, value: dimensions.lengthMm, unit: text.inchUnit, format: (mm: number) => lengthDisplay(mm, 'in').display },
    { key: 'maximum-diameter', label: text.maximumDiameter, value: dimensions.maximumDiameterMm, unit: text.millimetreUnit, format: formatDimension, distance: measurementCaption(dimensions.distances?.head, 'head') },
    { key: 'minimum-grip-diameter', label: text.minimumGripDiameter, value: grip.status === 'detected' ? grip.diameterMm : null, unit: text.millimetreUnit, format: formatDimension, distance: measurementCaption(dimensions.distances?.grip, 'grip') },
  ]
  return <dl className="dimensions-summary" aria-label={text.dimensions}>
    {measurements.map(measurement => {
      const value = measurement.value === null ? <span className="dimension-unavailable" title={measurement.key === 'minimum-grip-diameter' && grip.status === 'undetermined' ? gripDiagnosticText[grip.code] : undefined}>{text.missingValue}</span> : <><span>{measurement.format(measurement.value)}</span><span className="dimension-unit">{measurement.unit}</span></>
      return <div key={measurement.key}>
        <dt>{measurement.label}</dt>
        <dd data-testid={measurement.key}>
          {measurement.distance && <MeasurementDistance caption={measurement.distance} />}
          {measurement.distance ? <span className="dimension-value">{value}</span> : value}
        </dd>
      </div>
    })}
  </dl>
}
