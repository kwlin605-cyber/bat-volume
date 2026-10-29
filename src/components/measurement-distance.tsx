import { Ruler } from 'lucide-react'

export function MeasurementDistance({ caption }: { caption: string }) {
  return <span className="measurement-distance"><Ruler size={13} aria-hidden="true" /><span>{caption}</span></span>
}
