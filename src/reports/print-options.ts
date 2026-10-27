import type { BatchView } from '../features/batch/view-model'

export interface PrintOptions { separateGroups: boolean; fitOnePage: boolean }
export const defaultPrintOptions: Readonly<PrintOptions> = { separateGroups: true, fitOnePage: false }

/** Unknown rows retain their final position, continuing the last classified section. */
export function printSectionStarts(view: BatchView, separateGroups: boolean): number[] {
  return view.rows.flatMap((row, index) => index === 0 || (separateGroups && row.group && row.group !== 'unclassified' && row.group !== view.rows[index - 1].group) ? [index] : [])
}
