import type { BatDimensions } from '../domain/types'
import { defaultDiameterAllowanceMm, finishedDiameter } from '../domain/diameter-allowance'
import { formatDimension } from '../lib/format'
import { formatMeasurementDistance, measurementEndLabel, type MeasurementEnd } from '../lib/measurement-display'
import { text } from '../i18n/zh-TW'

export function PreviewMeasurements({ dimensions, diameterAllowanceMm = defaultDiameterAllowanceMm }: { dimensions: BatDimensions; diameterAllowanceMm?: number }) {
  const rows = [
    { end: 'head' as MeasurementEnd, label: text.maximumDiameter, diameter: dimensions.maximumDiameterMm, ranges: dimensions.distances?.head },
    { end: 'grip' as MeasurementEnd, label: text.minimumGripDiameter, diameter: dimensions.grip.status === 'detected' ? dimensions.grip.diameterMm : null, ranges: dimensions.distances?.grip },
  ]
  return <dl className="preview-measurements" aria-label={text.measurementDistance}>
    {rows.map(row => {
      const diameter = finishedDiameter(row.diameter, diameterAllowanceMm)
      return <div className="preview-measurement-row" key={row.end}>
        <dt>{row.label}</dt>
        <dd className="preview-measurement-diameter"><span>{diameter === null ? text.missingValue : formatDimension(diameter)}</span>{diameter !== null && <small>{text.millimetreUnit}</small>}</dd>
        <dd className="preview-measurement-position"><span>{measurementEndLabel(row.end)}</span><span>{formatMeasurementDistance(row.ranges)}{row.ranges?.length ? <small>{text.centimetreUnit}</small> : null}</span></dd>
      </div>
    })}
  </dl>
}
