import { Check, ChevronDown, CircleAlert, LoaderCircle } from 'lucide-react'
import type { UploadState } from '../services/analysis-state'
import { diagnosticText, text } from '../i18n/zh-TW'
import { formatCoordinate, formatVolume } from '../lib/format'
import { DimensionsSummary } from './dimensions-summary'

export function ResultCard({ state, diameterAllowanceMm }: { state: Exclude<UploadState, { status: 'empty' }>; diameterAllowanceMm?: number }) {
  const result = state.status === 'result' ? state.result : null
  const calculated = result?.status === 'calculated'
  const status = state.status === 'loading' ? text.loading : calculated ? (result.estimated ? text.estimated : text.calculated) : text.failed
  return <section className="result-card" aria-live="polite" aria-busy={state.status === 'loading'}>
    <div className={`status-pill ${calculated ? 'status-complete' : state.status !== 'loading' ? 'status-error' : ''}`}>
      {state.status === 'loading' ? <LoaderCircle className="spin" size={12} aria-hidden="true" /> : calculated ? <Check size={12} aria-hidden="true" /> : <CircleAlert size={12} aria-hidden="true" />}
      <span>{status}</span>
    </div>
    {state.status === 'loading' ? <div className="volume-block"><p className="volume-label">{text.loadingDescription}</p><div className="volume-skeleton" /></div> : calculated ? <>
      <div className="volume-block">
        <h1 className="volume-label">{text.retainedVolume}</h1>
        <div className="volume-value"><span data-testid="volume-value">{formatVolume(result.volumeCm3)}</span><span className="volume-unit">{text.volumeUnit}</span></div>
      </div>
      <DimensionsSummary diameterAllowanceMm={diameterAllowanceMm} dimensions={result.dimensions} />
      <details className="cut-details">
        <summary><span>{text.cuts}</span><ChevronDown size={15} aria-hidden="true" /></summary>
        <dl className="cut-values">
          <div><dt>{text.cutLow}</dt><dd data-testid="cut-low">{formatCoordinate(result.cuts.low)} <span>{text.millimetreUnit}</span></dd></div>
          <div><dt>{text.cutHigh}</dt><dd data-testid="cut-high">{formatCoordinate(result.cuts.high)} <span>{text.millimetreUnit}</span></dd></div>
        </dl>
        {result.estimated && <p className="calibration-note">{text.calibrationNote}</p>}
      </details>
    </> : state.status === 'unavailable' ? <div className="failure-block"><h1>{text[state.reason]}</h1></div>
      : result?.status === 'undetermined' ? <div className="failure-block"><h1>{diagnosticText[result.code]}</h1><p>{text.failureDescription}</p></div> : null}
  </section>
}
