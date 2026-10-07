import { useEffect, type RefObject } from 'react'

/** Each toolbar menu shares dismissal and only one can remain open. */
export function useDismissibleMenus(root: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const menus = Array.from(root.current?.querySelectorAll('details') ?? [])
    const dismissOutside = (event: Event) => {
      if (event.target instanceof Node) menus.forEach(menu => { if (!menu.contains(event.target as Node)) menu.open = false })
    }
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const open = menus.find(menu => menu.open)
      if (!open) return
      event.preventDefault(); open.open = false
      open.querySelector('summary')?.focus()
    }
    const keepOnlyActive = (event: Event) => {
      const active = event.currentTarget as HTMLDetailsElement
      if (active.open) menus.forEach(menu => { if (menu !== active) menu.open = false })
    }
    document.addEventListener('pointerdown', dismissOutside)
    document.addEventListener('focusin', dismissOutside)
    document.addEventListener('keydown', dismissEscape)
    menus.forEach(menu => menu.addEventListener('toggle', keepOnlyActive))
    return () => {
      document.removeEventListener('pointerdown', dismissOutside)
      document.removeEventListener('focusin', dismissOutside)
      document.removeEventListener('keydown', dismissEscape)
      menus.forEach(menu => menu.removeEventListener('toggle', keepOnlyActive))
    }
  }, [root])
}
