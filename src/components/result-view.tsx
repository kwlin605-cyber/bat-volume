import { lazy, Suspense } from 'react'
import { LoaderCircle } from 'lucide-react'
import { ResultCard } from './result-card'
import { PreviewBoundary } from './preview-boundary'
import type { ActiveUploadState } from '../services/analysis-state'
import { text } from '../i18n/zh-TW'
import type { PreviewMode } from './preview-mode'

const BatPreview = lazy(() => import('./bat-preview'))
export function ResultView({ state, preview, previewMode, diameterAllowanceMm }: { state: ActiveUploadState; preview: boolean; previewMode: PreviewMode; diameterAllowanceMm?: number }) {
  const result = state.status === 'result' ? state.result : null
  return <div className={`result-layout ${preview && result?.profile ? 'with-preview' : ''}`}>
    <ResultCard diameterAllowanceMm={diameterAllowanceMm} state={state} />
    {preview && result?.profile && <PreviewBoundary><Suspense fallback={<div className="preview-fallback"><LoaderCircle className="spin" size={18} />{text.previewLoading}</div>}><BatPreview result={result} mode={previewMode} /></Suspense></PreviewBoundary>}
  </div>
}
