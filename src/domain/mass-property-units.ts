import { defaultMassPropertyUnits } from '../config/mass-properties'
import { gramsPerOunce } from './weight-unit'
import { millimetresPerInch, type LengthUnit } from './length-unit'

export type InertiaUnit = 'kg-cm2' | 'oz-in2'
export interface MassPropertyUnits { balance: LengthUnit; inertia: InertiaUnit }
export const balanceUnits: readonly LengthUnit[] = ['cm', 'in']
export const inertiaUnits: readonly InertiaUnit[] = ['kg-cm2', 'oz-in2']
export const normalizeMassPropertyUnits = (value: unknown): MassPropertyUnits => {
  const candidate = value as Partial<MassPropertyUnits> | null
  return {
    balance: candidate?.balance === 'in' ? 'in' : defaultMassPropertyUnits.balance,
    inertia: candidate?.inertia === 'oz-in2' ? 'oz-in2' : defaultMassPropertyUnits.inertia,
  }
}
export const inertiaFromKgM2 = (value: number, unit: InertiaUnit) => unit === 'kg-cm2'
  ? value * 10_000
  : value * 1e9 / (gramsPerOunce * millimetresPerInch ** 2)
