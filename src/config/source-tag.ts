/** Screen dimensions; printed tags use the same proportions in points. */
export const sourceTagStyle = { fontSize: 11, fontWeight: 500, lineHeight: 17.6, paddingX: 7, paddingY: 2, borderWidth: 1, radius: 6, gap: 9 } as const

export function scaledSourceTagStyle(factor: number) {
  return Object.fromEntries(Object.entries(sourceTagStyle).map(([key, value]) => [key, key === 'fontWeight' ? value : value * factor])) as Record<keyof typeof sourceTagStyle, number>
}
