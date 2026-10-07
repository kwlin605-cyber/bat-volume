import { lazy, Suspense } from 'react'
import { LoaderCircle } from 'lucide-react'
import { ResultCard } from './result-card'
import { PreviewBoundary } from './preview-boundary'
import type { ActiveUploadState } from '../services/analysis-state'
import { text } from '../i18n/zh-TW'

const BatPreview = lazy(() => import('./bat-preview'))
export function ResultView({ state, preview }: { state: ActiveUploadState; preview: boolean }) {
  const result = state.status === 'result' ? state.result : null
  return <div className={`result-layout ${preview && result?.profile ? 'with-preview' : ''}`}>
    <ResultCard state={state} />
    {preview && result?.profile && <PreviewBoundary><Suspense fallback={<div className="preview-fallback"><LoaderCircle className="spin" size={18} />{text.previewLoading}</div>}><BatPreview result={result} /></Suspense></PreviewBoundary>}
  </div>
}
