import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { rowSelectionSettings as settings } from '../../config/selection'
import { clickRowSelection, mergeRowSelection, sameSelectedRows, selectRowRange, type RowSelection, type SelectableRow, type SelectionModifiers } from './row-selection'

export interface EditSelection { ids: string[]; anchor: { x: number; y: number } }

/** Own selection, dismissal and pointer lifecycle; completed selections open the shared editor. */
export function useRowSelection(rows: readonly SelectableRow[], disabled: boolean, surface: RefObject<HTMLDivElement | null>) {
  const [selection, setSelection] = useState<RowSelection>({ ids: [], anchor: null })
  const current = useRef(selection)
  const [editing, setEditing] = useState<EditSelection | null>(null)
  const [dragging, setDragging] = useState(false)
  const cleanup = useRef<(() => void) | null>(null)
  const cleanupClick = useRef<(() => void) | null>(null)
  const suppressClick = useRef(false)
  const orderKey = rows.map(row => row.id).join('|')
  const update = useCallback((next: RowSelection) => { current.current = next; setSelection(next) }, [])
  const cancel = useCallback(() => {
    cleanup.current?.(); cleanup.current = null
    update({ ids: [], anchor: null }); setEditing(null); setDragging(false)
  }, [update])
  useEffect(() => { cancel(); return () => { cleanup.current?.(); cleanupClick.current?.() } }, [orderKey, disabled, cancel])
  function suppressReleaseClick() {
    cleanupClick.current?.()
    suppressClick.current = true
    const release = () => {
      document.removeEventListener('click', ignore, true)
      document.removeEventListener('pointerdown', release, true)
      suppressClick.current = false; cleanupClick.current = null
    }
    const ignore = (click: MouseEvent) => { click.preventDefault(); click.stopPropagation(); release() }
    document.addEventListener('click', ignore, { capture: true, once: true })
    document.addEventListener('pointerdown', release, { capture: true, once: true })
    cleanupClick.current = release
  }
  function select(id: string, modifiers: SelectionModifiers, element: HTMLElement) {
    if (disabled || suppressClick.current) return
    const next = clickRowSelection(rows, current.current, id, modifiers)
    if (next === current.current) return
    update(next)
    const rect = element.getBoundingClientRect()
    showEditor(next.ids, { x: rect.right, y: rect.bottom })
  }
  function showEditor(ids: string[], anchor: EditSelection['anchor']) {
    if (!ids.length) { setEditing(null); return }
    setEditing(previous => previous && sameSelectedRows(previous.ids, ids) ? { ...previous, anchor } : { ids, anchor })
  }
  useEffect(() => {
    // One owner for dismissal keeps modifier clicks from clearing the range anchor.
    const outside = (event: PointerEvent | FocusEvent) => {
      if (!(event.target instanceof Element) || event.target.closest('.requirement-popover')) return
      if (!surface.current?.contains(event.target) || !event.target.closest('[data-row-id]')) cancel()
    }
    const focus = (event: FocusEvent) => { if (!cleanup.current) outside(event) }
    const key = (event: KeyboardEvent) => {
      if (disabled || !current.current.ids.length || cleanup.current) return
      if (event.key === 'Escape') { event.preventDefault(); cancel(); return }
    }
    document.addEventListener('pointerdown', outside); document.addEventListener('focusin', focus); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('focusin', focus); document.removeEventListener('keydown', key) }
  }, [cancel, disabled, surface])
  function pointerDown(event: ReactPointerEvent<HTMLTableRowElement>, id: string) {
    if (disabled || event.button !== 0 || event.pointerType !== 'mouse' || !rows.some(row => row.id === id && !row.pending)) return
    const target = event.target
    const modified = event.ctrlKey || event.shiftKey
    if (!(target instanceof Element) || target.closest('input, a, button:not(.requirement-trigger, .filename-button)') || !modified && target.closest('.filename-button')) return
    event.preventDefault()
    cleanup.current?.(); cleanup.current = null
    suppressClick.current = false
    const table = event.currentTarget.closest('table')!
    const base = current.current, additive = event.ctrlKey
    const anchor = event.shiftKey && base.anchor && rows.some(row => row.id === base.anchor && !row.pending) ? base.anchor : id
    const startX = event.clientX, startY = event.clientY, pointerId = event.pointerId
    let x = startX, y = startY, moved = false, selected = base.ids, frame = 0, previousTime = 0
    function updateRange() {
      const hit = document.elementFromPoint(x, Math.max(0, Math.min(window.innerHeight - 1, y)))?.closest<HTMLTableRowElement>('[data-row-id]')
      if (hit && table.contains(hit)) {
        const range = selectRowRange(rows, anchor, hit.dataset.rowId!)
        selected = additive ? mergeRowSelection(rows, base.ids, range) : range
        update({ ids: selected, anchor })
      }
    }
    function scroll(time: number) {
      if (moved) {
        const elapsed = previousTime ? Math.min(32, time - previousTime) : 16
        const distance = y < settings.scrollEdge ? -Math.min(1, (settings.scrollEdge - y) / settings.scrollEdge)
          : y > window.innerHeight - settings.scrollEdge ? Math.min(1, (y - window.innerHeight + settings.scrollEdge) / settings.scrollEdge) : 0
        if (distance) { window.scrollBy(0, distance * settings.scrollPixelsPerSecond * elapsed / 1000); updateRange() }
      }
      previousTime = time
      frame = requestAnimationFrame(scroll)
    }
    function move(e: PointerEvent) {
      if (e.pointerId !== pointerId) return
      x = e.clientX; y = e.clientY
      if (!moved && Math.hypot(x - startX, y - startY) >= settings.dragThreshold) {
        moved = true; setDragging(true)
        const range = selectRowRange(rows, anchor, id)
        selected = additive ? mergeRowSelection(rows, base.ids, range) : range
        update({ ids: selected, anchor })
      }
      if (moved) { e.preventDefault(); updateRange() }
    }
    function finish(e: PointerEvent) {
      if (e.pointerId !== pointerId) return
      if (moved) { x = e.clientX; y = e.clientY; updateRange() }
      cleanup.current?.(); cleanup.current = null
      setDragging(false)
      if (!moved) return
      suppressReleaseClick()
      showEditor(selected, { x: e.clientX, y: e.clientY })
    }
    function abort() { suppressReleaseClick(); cancel() }
    function key(e: KeyboardEvent) { if (e.key === 'Escape') { e.preventDefault(); abort() } }
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', finish)
    document.addEventListener('pointercancel', abort); document.addEventListener('keydown', key)
    window.addEventListener('blur', abort)
    frame = requestAnimationFrame(scroll)
    cleanup.current = () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', finish)
      document.removeEventListener('pointercancel', abort); document.removeEventListener('keydown', key)
      window.removeEventListener('blur', abort)
    }
  }
  return { ids: selection.ids, editing, dragging, cancel, select, pointerDown, suppressClick }
}
