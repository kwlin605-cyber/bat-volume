import { describe, expect, it } from 'vitest'
import { buildColumnLayout, textUnits, type TextMeasure } from '../src/features/batch/column-layout'
import type { BatchView } from '../src/features/batch/view-model'
import { geometryColumns as metricColumns } from '../src/features/batch/columns'
import { batchTableStyle } from '../src/config/batch'
import { buildReportLayout } from '../src/reports/report-layout'

const measure: TextMeasure = (value, font) => textUnits(value) * font.size * 0.6
function view(name: string, display = '1,130', detail = ''): BatchView {
  return { columns: [...metricColumns], sort: { key: 'name', direction: 'asc' }, sortLabel: '',
    summary: { total: 1, calculated: 1, failed: 0, pending: 0 },
    rows: [{ id: '1', name, pending: false, status: { label: '', detail, kind: 'complete' },
      cells: { batWeight: { value: null, display: '—' }, materialWeight: { value: null, display: '—' }, volume: { value: 1129.9491175359196, display }, length: { value: 870.16, display: '870.2' },
        maximumDiameter: { value: 57.48, display: '57.5' }, gripDiameter: { value: 21.26, display: '21.3' } } }] }
}

describe('content-based column sizing shared by table and exports', () => {
  it('grows filename and numeric columns with displayed content, while bounding long filenames', () => {
    const short = buildColumnLayout(view('a.anc'), batchTableStyle, measure)
    const longer = buildColumnLayout(view('中等長度的球棒檔案名稱.anc', '123,456,789'), batchTableStyle, measure)
    const longest = buildColumnLayout(view('長檔名'.repeat(100)), batchTableStyle, measure)
    expect(longer.filenameWidth).toBeGreaterThan(short.filenameWidth)
    expect(longer.columns[0].width).toBeGreaterThan(short.columns[0].width)
    expect(longest.filenameWidth).toBe(batchTableStyle.maximumFilenameWidth)
    const precise = view('a.anc')
    precise.rows[0].cells.volume.value = 1129.0000000000000001
    expect(buildColumnLayout(precise, batchTableStyle, measure)).toEqual(short)
  })
  it('includes labels, units, diagnostic text and every row, independent of row order', () => {
    const data = view('a.anc', '—', '無法判斷原因'.repeat(8))
    data.columns = [{ ...metricColumns[0], label: '很長的欄位標題', unit: '很長的單位文字' }]
    data.rows.push({ ...data.rows[0], id: '2', name: 'b.anc', cells: { ...data.rows[0].cells, volume: { value: 1234567890, display: '1,234,567,890' } } })
    const layout = buildColumnLayout(data, batchTableStyle, measure)
    expect(layout.columns[0].width).toBeGreaterThanOrEqual(measure(data.columns[0].label, data.columns[0].prominent ? batchTableStyle.fonts.primaryHeader : batchTableStyle.fonts.header) + 40)
    expect(layout.columns[0].width).toBeGreaterThanOrEqual(measure(data.columns[0].unit, batchTableStyle.fonts.unit) + 40)
    expect(layout.filenameWidth).toBeGreaterThan(180)
    expect(buildColumnLayout({ ...data, rows: [...data.rows].reverse() }, batchTableStyle, measure)).toEqual(layout)
  })
  it('fits available space by wrapping filenames without squeezing numeric columns', () => {
    const data = view('長檔名'.repeat(100))
    const natural = buildColumnLayout(data, batchTableStyle, measure)
    const limited = buildColumnLayout(data, batchTableStyle, measure, natural.width - 150)
    expect(limited.width).toBe(natural.width - 150)
    expect(limited.columns).toEqual(natural.columns)
    const hidden = buildColumnLayout({ ...data, columns: [] }, batchTableStyle, measure)
    expect(hidden.columns).toEqual([])
    expect(hidden.width).toBe(hidden.filenameWidth)
  })
  it('makes report width respond to names and values, with complete wrapped filenames', () => {
    const short = buildReportLayout(view('a.anc'), (value, size) => measure(value, { size, weight: 400 }))
    const data = view('很長的球棒名稱'.repeat(80), '1,234,567,890')
    const long = buildReportLayout(data, (value, size) => measure(value, { size, weight: 400 }))
    expect(long.width).toBeGreaterThan(short.width)
    expect(long.rows[0].nameLines.join('')).toBe(data.rows[0].name)
    expect(long.columns[0].width).toBeGreaterThan(short.columns[0].width)
  })
})
