import { Component } from 'react'
import type { ReactNode } from 'react'
import { text } from '../i18n/zh-TW'

export class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <div className="preview-fallback">{text.previewUnavailable}</div> : this.props.children }
}
