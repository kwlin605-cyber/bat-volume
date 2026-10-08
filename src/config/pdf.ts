export type PdfOrientation = 'portrait' | 'landscape'

export const pdfSettings = {
  a4: { width: 595.28, height: 841.89 },
  // Lossless 216 dpi pages keep browser-rendered Chinese fonts consistent.
  pixelsPerPoint: 3,
} as const

export function pdfPageSize(orientation: PdfOrientation) {
  const { width, height } = pdfSettings.a4
  return orientation === 'portrait' ? { width, height } : { width: height, height: width }
}
