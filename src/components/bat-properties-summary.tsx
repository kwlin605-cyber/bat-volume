import type { BatProperties } from '../domain/bat-properties'
import type { MassPropertyUnits } from '../domain/mass-property-units'
import { batPropertyDisplay } from '../lib/mass-property-display'
import { text } from '../i18n/zh-TW'

export function BatPropertiesSummary({ properties, units, showWeight = true, className = 'dimensions-summary' }: {
  properties: BatProperties; units: MassPropertyUnits; showWeight?: boolean; className?: string
}) {
  const rows = batPropertyDisplay(properties, units).filter(row => showWeight || row.id !== 'weight')
  return <dl className={`${className} bat-properties-summary`} aria-label={text.massPropertiesDescription} title={text.massPropertiesDescription}>
    {rows.map(row => <div key={row.id}>
      <dt>{row.label}</dt>
      <dd data-testid={`property-${row.id}`}><span>{row.display}</span>{row.unit && <small className="dimension-unit">{row.unit}</small>}</dd>
    </div>)}
  </dl>
}
