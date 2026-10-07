import type { AnalysisResult, SourceInfo } from '../domain/types'

export type ActiveUploadState =
  | { status: 'loading'; source: SourceInfo }
  | { status: 'result'; result: AnalysisResult }
export type UploadState = { status: 'empty' } | ActiveUploadState
export interface AnalysisEntry { id: string; source: SourceInfo; state: ActiveUploadState }
