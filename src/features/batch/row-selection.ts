export interface SelectableRow { id: string; pending: boolean }
export interface RowSelection { ids: string[]; anchor: string | null }
export interface SelectionModifiers { ctrlKey: boolean; shiftKey: boolean }

/** Canonical visual order makes draft identity independent of pointer position. */
export function sameSelectedRows(first: readonly string[], second: readonly string[]): boolean {
  return first.length === second.length && first.every((id, index) => id === second[index])
}

export function mergeRowSelection(rows: readonly SelectableRow[], ...groups: readonly string[][]): string[] {
  const ids = new Set(groups.flat())
  return rows.filter(row => !row.pending && ids.has(row.id)).map(row => row.id)
}

/** Modifier clicks use a stable range anchor and the currently displayed order. */
export function clickRowSelection(rows: readonly SelectableRow[], current: RowSelection, id: string, modifiers: SelectionModifiers): RowSelection {
  if (!rows.some(row => row.id === id && !row.pending)) return current
  if (modifiers.shiftKey) {
    const anchor = rows.some(row => row.id === current.anchor && !row.pending) ? current.anchor! : id
    const range = selectRowRange(rows, anchor, id)
    return { ids: modifiers.ctrlKey ? mergeRowSelection(rows, current.ids, range) : range, anchor }
  }
  if (modifiers.ctrlKey) {
    const ids = current.ids.includes(id) ? current.ids.filter(value => value !== id) : [...current.ids, id]
    return { ids: mergeRowSelection(rows, ids), anchor: id }
  }
  return { ids: [id], anchor: id }
}

/** Select by current visual order and file identity, never by filename or numeric value. */
export function selectRowRange(rows: readonly SelectableRow[], start: string, end: string): string[] {
  const first = rows.findIndex(row => row.id === start), last = rows.findIndex(row => row.id === end)
  if (first < 0 || last < 0) return []
  return rows.slice(Math.min(first, last), Math.max(first, last) + 1).filter(row => !row.pending).map(row => row.id)
}
