export type DiagnosticCode =
  | 'emptyProgram' | 'unsupportedInstruction' | 'invalidCoordinate'
  | 'noProfile' | 'nonMonotoneProfile' | 'nonAxisymmetricProfile'
  | 'invalidRadius' | 'missingLowEnd' | 'missingHighEnd' | 'missingBothEnds'
  | 'invalidCuts' | 'strategiesDisagree' | 'noApplicableStrategy'
  | 'wrongFileType' | 'fileTooLarge' | 'readFailed' | 'processingFailed'

export interface RawPoint { y: number; z: number; x: number; line: number; hasY: boolean }
export interface FeedSweep { points: RawPoint[]; span: number }
export interface Program { sweeps: FeedSweep[]; lineCount: number }
export interface ProfilePoint { y: number; radius: number; line: number }
export interface Profile {
  points: ProfilePoint[]
  range: { low: number; high: number }
  sourceLines: { start: number; end: number }
  sweepCount: number
}
export interface Cuts { low: number; high: number }
export interface GeometryCalibration {
  id: string
  version: string
  radiusScale: number
  radiusOffsetMm: number
  lowerCutCorrectionMm: number
  upperCutCorrectionMm: number
  validated: boolean
}
export interface RuleParameters {
  coordinateToleranceMm: number
  minimumStubLengthMm: number
  strategyAgreementToleranceMm: number
}
export interface StrategyContext { calibration: GeometryCalibration; parameters: RuleParameters }
export interface CutEvidence { end: 'low' | 'high'; y: number; line: number; stubLengthMm: number }
export type StrategyDecision =
  | { status: 'detected'; cuts: Cuts; evidence: CutEvidence[] }
  | { status: 'undetermined'; code: DiagnosticCode; partial: Partial<Cuts>; evidence: CutEvidence[] }
export interface CutStrategy {
  id: string
  version: string
  applicable(profile: Profile, context: StrategyContext): boolean
  detect(profile: Profile, context: StrategyContext): StrategyDecision
}
export interface SourceInfo { name: string; size: number }
export interface RuleTrace { strategy: string; version: string; evidence: CutEvidence[] }
export type GripDiagnosticCode = 'ambiguousGripEnd' | 'missingGripKnob' | 'unboundedGripMinimum' | 'gripStrategiesDisagree' | 'noApplicableGripStrategy'
export interface GripParameters {
  endBand: { startFraction: number; endFraction: number }
  minimumEndRadiusRatio: number
  knobSearchFraction: number
  minimumKnobRiseMm: number
  minimumKnobDropRatio: number
  minimumSearchFraction: number
  minimumInteriorFraction: number
  minimumRecoveryMm: number
  regionRadiusFraction: number
  coordinateToleranceMm: number
  strategyAgreementToleranceMm: number
}
export interface GripContext { parameters: GripParameters }
export type GripRegionDecision =
  | { status: 'detected'; region: Cuts; end: 'low' | 'high' }
  | { status: 'undetermined'; code: GripDiagnosticCode }
export interface GripStrategy {
  id: string
  version: string
  applicable(points: readonly ProfilePoint[], context: GripContext): boolean
  detect(points: readonly ProfilePoint[], context: GripContext): GripRegionDecision
}
export type GripMeasurement =
  | { status: 'detected'; diameterMm: number; minimum: ProfilePoint; region: Cuts; end: 'low' | 'high'; rule: { strategy: string; version: string } }
  | { status: 'undetermined'; code: GripDiagnosticCode }
export interface BatDimensions {
  lengthMm: number
  maximumDiameterMm: number
  maximum: ProfilePoint
  grip: GripMeasurement
}
export type AnalysisResult =
  | { status: 'calculated'; source: SourceInfo; profile: Profile; retained: ProfilePoint[];
      cuts: Cuts; volumeMm3: number; volumeCm3: number; dimensions: BatDimensions; estimated: boolean;
      rule: RuleTrace; calibration: { id: string; version: string } }
  | { status: 'undetermined'; source: SourceInfo; code: DiagnosticCode;
      profile?: Profile; partial?: Partial<Cuts>; detail?: string }

export class AnalysisError extends Error {
  constructor(public readonly code: DiagnosticCode, public readonly detail?: string) {
    super(code)
    this.name = 'AnalysisError'
  }
}
