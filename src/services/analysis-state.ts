import type { AnalysisResult, SourceInfo } from '../domain/types'
import type { FileOrigin } from './file-origin'

export interface SourceUnavailable { status: 'unavailable'; source: SourceInfo; reason: 'presetRemoved' | 'presetLoadFailed' }
export type AnalysisOutcome = AnalysisResult | SourceUnavailable
export interface AnalysisSource { id: string; origin?: FileOrigin; source: SourceInfo; load: () => Promise<File | null> }

export type ActiveUploadState =
  | { status: 'loading'; source: SourceInfo }
  | { status: 'result'; result: AnalysisResult }
  | SourceUnavailable
export type UploadState = { status: 'empty' } | ActiveUploadState
export interface AnalysisEntry { id: string; origin?: FileOrigin; source: SourceInfo; state: ActiveUploadState }
