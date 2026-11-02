import type { AnalysisResult } from '../../domain/types'
import { text } from '../../i18n/zh-TW'
import { formatDimension, formatVolume } from '../../lib/format'
import type { WeightDisplayMode } from '../../domain/weight-unit'
import { weightHeaderUnit, weightNumberFormat } from '../../lib/weight-display'
import type { MetricId } from '../../domain/batch-display'
import type { LengthDisplayMode } from '../../domain/length-unit'
import { lengthDisplay, lengthHeaderUnit, lengthNumberFormat } from '../../lib/length-display'
import type { MassPropertyUnits } from '../../domain/mass-property-units'
import { defaultMassPropertyUnits } from '../../config/mass-properties'
import { balanceUnitLabel, inertiaUnitLabel } from '../../lib/mass-property-display'
export { defaultMetricIds, type MetricId } from '../../domain/batch-display'

type Calculated = Extract<AnalysisResult, { status: 'calculated' }>
export const geometryColumns = [
  { id: 'volume', label: text.retainedVolume, unit: text.volumeUnit, numberFormat: '#,##0', prominent: false, value: (r: Calculated) => r.volumeCm3, format: formatVolume },
  { id: 'length', label: text.retainedLength, unit: text.centimetreUnit, numberFormat: '#,##0.0', prominent: false, value: (r: Calculated) => r.dimensions.lengthMm, format: (mm: number) => lengthDisplay(mm, 'cm').display },
  { id: 'maximumDiameter', label: text.maximumDiameter, unit: text.millimetreUnit, numberFormat: '#,##0.0', prominent: false, value: (r: Calculated) => r.dimensions.maximumDiameterMm, format: formatDimension },
  { id: 'gripDiameter', label: text.minimumGripDiameter, unit: text.millimetreUnit, numberFormat: '#,##0.0', prominent: false, value: (r: Calculated) => r.dimensions.grip.status === 'detected' ? r.dimensions.grip.diameterMm : null, format: formatDimension },
] as const
export type GeometryMetricId = typeof geometryColumns[number]['id']
export interface MetricColumn { id: MetricId; label: string; unit: string; numberFormat: string; prominent: boolean; editable?: boolean; weightMode?: WeightDisplayMode; lengthMode?: LengthDisplayMode; splitUnits?: boolean; balanceUnit?: MassPropertyUnits['balance']; inertiaUnit?: MassPropertyUnits['inertia'] }
const [volumeColumn, ...dimensionColumns] = geometryColumns
export const metricColumns: readonly MetricColumn[] = [
  volumeColumn,
  { id: 'materialWeight', label: text.materialWeight, unit: text.weightUnit, numberFormat: '#,##0', prominent: false },
  { id: 'batWeight', label: text.batWeight, unit: text.weightUnit, numberFormat: '#,##0', prominent: true, editable: true },
  ...dimensionColumns,
  { id: 'balancePoint', label: text.balancePoint, unit: text.centimetreUnit, numberFormat: '#,##0.0', prominent: false },
  { id: 'moi', label: text.momentOfInertia, unit: text.kilogramCentimetresSquared, numberFormat: '#,##0', prominent: false },
]
export const allMetricIds: MetricId[] = metricColumns.map(column => column.id)
export const geometryMetricIds: MetricId[] = geometryColumns.map(column => column.id)
export const columnsForUnits = (mode: WeightDisplayMode, lengthMode: LengthDisplayMode = 'cm', massUnits: MassPropertyUnits = defaultMassPropertyUnits): MetricColumn[] => metricColumns.map(column =>
  column.id === 'materialWeight'
    ? { ...column, unit: weightHeaderUnit(mode), numberFormat: weightNumberFormat(mode), weightMode: mode, splitUnits: mode === 'both' }
    : column.id === 'length'
      ? { ...column, unit: lengthHeaderUnit(lengthMode), numberFormat: lengthNumberFormat(lengthMode), lengthMode }
      : column.id === 'balancePoint'
        ? { ...column, unit: balanceUnitLabel(massUnits.balance), balanceUnit: massUnits.balance }
        : column.id === 'moi'
          ? { ...column, unit: inertiaUnitLabel(massUnits.inertia), inertiaUnit: massUnits.inertia }
          : column)
