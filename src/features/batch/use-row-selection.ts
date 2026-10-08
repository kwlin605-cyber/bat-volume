import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { rowSelectionSettings as settings } from '../../config/selection'
import { selectRowRange, type SelectableRow } from './row-selection'

export interface EditSelection { ids: string[]; anchor: { x: number; y: number } }

/** Pointer lifecycle and autoscroll own selection only, never committed requirements. */
export function useRowSelection(rows: readonly SelectableRow[], disabled: boolean) {
  const [ids, setIds] = useState<string[]>([])
  const [editing, setEditing] = useState<EditSelection | null>(null)
  const [dragging, setDragging] = useState(false)
  const cleanup = useRef<(() => void) | null>(null)
  const cleanupClick = useRef<(() => void) | null>(null)
  const suppressClick = useRef(false)
  const orderKey = rows.map(row => row.id).join('|')
  function cancel() {
    cleanup.current?.(); cleanup.current = null
    setIds([]); setEditing(null); setDragging(false)
  }
  useEffect(() => { cancel(); return () => { cleanup.current?.(); cleanupClick.current?.() } }, [orderKey, disabled])
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
  function open(id: string, element: HTMLElement) {
    if (disabled || !rows.some(row => row.id === id && !row.pending)) return
    cleanup.current?.(); cleanup.current = null
    const rect = element.getBoundingClientRect()
    setIds([id]); setDragging(false)
    setEditing({ ids: [id], anchor: { x: rect.right, y: rect.bottom } })
  }
  function pointerDown(event: ReactPointerEvent<HTMLTableRowElement>, id: string) {
    if (disabled || event.button !== 0 || event.pointerType !== 'mouse' || !rows.some(row => row.id === id && !row.pending)) return
    const target = event.target
    if (!(target instanceof Element) || target.closest('button:not(.requirement-trigger), input, a')) return
    event.preventDefault()
    cancel(); suppressClick.current = false
    const table = event.currentTarget.closest('table')!
    const startX = event.clientX, startY = event.clientY, pointerId = event.pointerId
    let x = startX, y = startY, moved = false, selected = [id], frame = 0, previousTime = 0
    function update() {
      const hit = document.elementFromPoint(x, Math.max(0, Math.min(window.innerHeight - 1, y)))?.closest<HTMLTableRowElement>('[data-row-id]')
      if (hit && table.contains(hit)) {
        selected = selectRowRange(rows, id, hit.dataset.rowId!)
        setIds(selected)
      }
    }
    function scroll(time: number) {
      if (moved) {
        const elapsed = previousTime ? Math.min(32, time - previousTime) : 16
        const distance = y < settings.scrollEdge ? -Math.min(1, (settings.scrollEdge - y) / settings.scrollEdge)
          : y > window.innerHeight - settings.scrollEdge ? Math.min(1, (y - window.innerHeight + settings.scrollEdge) / settings.scrollEdge) : 0
        if (distance) { window.scrollBy(0, distance * settings.scrollPixelsPerSecond * elapsed / 1000); update() }
      }
      previousTime = time
      frame = requestAnimationFrame(scroll)
    }
    function move(e: PointerEvent) {
      if (e.pointerId !== pointerId) return
      x = e.clientX; y = e.clientY
      if (!moved && Math.hypot(x - startX, y - startY) >= settings.dragThreshold) {
        moved = true; setDragging(true); setIds(selected)
      }
      if (moved) { e.preventDefault(); update() }
    }
    function finish(e: PointerEvent) {
      if (e.pointerId !== pointerId) return
      cleanup.current?.(); cleanup.current = null
      setDragging(false)
      if (!moved) return
      suppressReleaseClick()
      if (selected.length) setEditing({ ids: selected, anchor: { x: e.clientX, y: e.clientY } })
      // The release click must not open a filename preview or replace the selected range.
    }
    function abort() { suppressReleaseClick(); cancel() }
    function key(e: KeyboardEvent) { if (e.key === 'Escape') { e.preventDefault(); abort() } }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', finish)
    document.addEventListener('pointercancel', abort)
    document.addEventListener('keydown', key)
    window.addEventListener('blur', abort)
    frame = requestAnimationFrame(scroll)
    cleanup.current = () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', finish)
      document.removeEventListener('pointercancel', abort); document.removeEventListener('keydown', key)
      window.removeEventListener('blur', abort)
    }
  }
  return { ids, editing, dragging, cancel, open, pointerDown, suppressClick }
}
