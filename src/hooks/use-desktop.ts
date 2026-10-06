import { useEffect, useState } from 'react'
import { desktopQuery } from '../config/analysis'

export function useDesktop() {
  const [desktop, setDesktop] = useState(() => window.matchMedia(desktopQuery).matches)
  useEffect(() => {
    const media = window.matchMedia(desktopQuery)
    const update = () => setDesktop(media.matches)
    media.addEventListener('change', update)
    update()
    return () => media.removeEventListener('change', update)
  }, [])
  return desktop
}
