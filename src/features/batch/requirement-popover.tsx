import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { WeightRange } from '../../domain/weight'
import { rowSelectionSettings as settings } from '../../config/selection'
import { text } from '../../i18n/zh-TW'
import { WeightEditor } from './weight-editor'
import type { EditSelection } from './use-row-selection'

/** Single and multiple selections share one editor without changing table geometry. */
export function RequirementPopover({ selection, value, hidden = false, onCommit, onCancel }: {
  selection: EditSelection; value: WeightRange | null
  hidden?: boolean
  onCommit: (value: WeightRange | null) => void; onCancel: () => void
}) {
  const root = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number }>({ left: settings.viewportPadding, top: settings.viewportPadding })
  useLayoutEffect(() => {
    const rect = root.current!.getBoundingClientRect(), { x, y } = selection.anchor
    setPosition({
      left: Math.max(settings.viewportPadding, Math.min(x - rect.width, window.innerWidth - rect.width - settings.viewportPadding)),
      top: Math.max(settings.viewportPadding, y + rect.height + settings.popoverGap < window.innerHeight
        ? y + settings.popoverGap : y - rect.height - settings.popoverGap),
    })
  }, [selection])
  useEffect(() => {
    window.addEventListener('resize', onCancel)
    return () => window.removeEventListener('resize', onCancel)
  }, [onCancel])
  useEffect(() => { if (!hidden) root.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true }) }, [hidden, selection])
  return createPortal(<div ref={root} className="requirement-popover" role="dialog" aria-label={text.editRequirement}
    aria-hidden={hidden || undefined} style={{ ...position, width: settings.popoverWidth, visibility: hidden ? 'hidden' : undefined,
      '--selection-background': settings.colors.background, '--selection-accent': settings.colors.accent, '--selection-border': settings.colors.border } as React.CSSProperties}>
    <div className="requirement-popover-heading"><span>{selection.ids.length > 1 ? text.selectedBatCount.replace('{count}', String(selection.ids.length)) : text.batWeight}</span>
      <button type="button" className="icon-button" aria-label={text.cancel} onClick={onCancel}><X size={15} /></button></div>
    <WeightEditor value={value} onCommit={onCommit} onCancel={onCancel} />
  </div>, document.body)
}
