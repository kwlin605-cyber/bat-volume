import type { AnalysisResult, SourceInfo } from '../domain/types'

export interface AnalysisRequest { id: number; text: string; source: SourceInfo }
export interface AnalysisResponse { id: number; result: AnalysisResult }
