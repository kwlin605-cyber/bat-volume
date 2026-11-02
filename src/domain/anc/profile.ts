import { AnalysisError } from '../types'
import type { GeometryCalibration, Profile, Program } from '../types'
import { extractBladeEnvelope } from './blade-envelope'

export function extractProfile(program: Program, calibration: GeometryCalibration, bladeWidthMm = 0): Profile {
  if (!Number.isFinite(bladeWidthMm) || bladeWidthMm < 0) throw new AnalysisError('invalidCoordinate')
  const firstX = program.sweeps[0]?.points[0]?.x
  for (const sweep of program.sweeps) {
    if (sweep.points.some(point => Math.abs(point.x - firstX!) > 0.001)) throw new AnalysisError('nonAxisymmetricProfile')
  }
  return extractBladeEnvelope(program, calibration, bladeWidthMm)
}
