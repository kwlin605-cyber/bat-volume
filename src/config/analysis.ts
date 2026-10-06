import type { GeometryCalibration, GripParameters, RuleParameters } from '../domain/types'

// These are provisional coordinate conventions, not a verified machine calibration.
// Replace this calibration after measuring actual radius and physical cut locations.
export const calibration: GeometryCalibration = {
  id: 'program-z-as-radius',
  version: '1.0.0',
  radiusScale: 1,
  radiusOffsetMm: 0,
  lowerCutCorrectionMm: 0,
  upperCutCorrectionMm: 0,
  validated: false,
}

export const ruleParameters: RuleParameters = {
  coordinateToleranceMm: 0.005,
  minimumStubLengthMm: 0.2,
  strategyAgreementToleranceMm: 0.05,
}

// Conventional bat shapes: identify the narrower end, then a knob and an
// interior handle valley. These thresholds are intentionally versioned with
// the grip strategy rather than being embedded in display components.
export const gripParameters: GripParameters = {
  endBand: { startFraction: 0.1, endFraction: 0.25 },
  minimumEndRadiusRatio: 1.45,
  knobSearchFraction: 0.08,
  minimumKnobRiseMm: 1,
  minimumKnobDropRatio: 0.25,
  minimumSearchFraction: 0.45,
  minimumInteriorFraction: 0.015,
  minimumRecoveryMm: 0.5,
  regionRadiusFraction: 0.35,
  coordinateToleranceMm: 0.005,
  strategyAgreementToleranceMm: 0.05,
}

export const fileLimits = { maxBytes: 20 * 1024 * 1024, extension: '.anc' }
export const desktopQuery = '(min-width: 1024px)'
