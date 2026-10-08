export interface SelectableRow { id: string; pending: boolean }

/** Select by current visual order and file identity, never by filename or numeric value. */
export function selectRowRange(rows: readonly SelectableRow[], start: string, end: string): string[] {
  const first = rows.findIndex(row => row.id === start), last = rows.findIndex(row => row.id === end)
  if (first < 0 || last < 0) return []
  return rows.slice(Math.min(first, last), Math.max(first, last) + 1).filter(row => !row.pending).map(row => row.id)
}
