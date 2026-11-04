import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { text } from '../../i18n/zh-TW'
import { useDialogBackdrop } from '../../hooks/use-dialog-backdrop'

type SettingsTab = 'primary' | 'secondary'

export function SettingsDialog({ title, onDismiss, children, secondaryPage }: {
  title: string
  onDismiss: () => void
  children: ReactNode
  secondaryPage?: { primaryLabel: string; label: string; content: ReactNode }
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const backdrop = useDialogBackdrop()
  const [activeTab, setActiveTab] = useState<SettingsTab>('primary')
  const primaryTab = useRef<HTMLButtonElement>(null)
  const secondaryTab = useRef<HTMLButtonElement>(null)
  const showSecondary = Boolean(secondaryPage) && activeTab === 'secondary'

  function navigateTab(event: KeyboardEvent<HTMLButtonElement>) {
    let next: SettingsTab
    if (event.key === 'Home') next = 'primary'
    else if (event.key === 'End') next = 'secondary'
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') next = activeTab === 'primary' ? 'secondary' : 'primary'
    else return
    event.preventDefault()
    setActiveTab(next)
    const nextTab = next === 'primary' ? primaryTab : secondaryTab
    nextTab.current?.focus()
  }

  useEffect(() => {
    opener.current ??= document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (dialog.current && !dialog.current.open) dialog.current.showModal()
    return () => {
      if (opener.current?.isConnected) opener.current.focus({ preventScroll: true })
    }
  }, [])

  return (
    <dialog ref={dialog} className={`material-dialog${secondaryPage ? ' mobile-settings-dialog' : ''}`} aria-labelledby={titleId} onClose={onDismiss} {...backdrop}>
      <header className="settings-heading">
        <h2 id={titleId} tabIndex={-1} autoFocus>{title}</h2>
        <button type="button" className="settings-close" onClick={onDismiss} aria-label={text.closeSettings}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      {secondaryPage && (
        <div className="settings-tabs" role="tablist" aria-label={title}>
          <button ref={primaryTab} type="button" id={`${titleId}-primary-tab`} role="tab" aria-selected={!showSecondary} aria-controls={`${titleId}-primary-panel`} tabIndex={!showSecondary ? 0 : -1} onClick={() => setActiveTab('primary')} onKeyDown={navigateTab}>{secondaryPage.primaryLabel}</button>
          <button ref={secondaryTab} type="button" id={`${titleId}-secondary-tab`} role="tab" aria-selected={showSecondary} aria-controls={`${titleId}-secondary-panel`} tabIndex={showSecondary ? 0 : -1} onClick={() => setActiveTab('secondary')} onKeyDown={navigateTab}>{secondaryPage.label}</button>
        </div>
      )}
      <div className="settings-panels">
        {/* Keep primary content mounted across page and responsive layout changes. */}
        <section role={secondaryPage ? 'tabpanel' : undefined} id={`${titleId}-primary-panel`} aria-labelledby={secondaryPage ? `${titleId}-primary-tab` : undefined} hidden={showSecondary}>
          {children}
        </section>
        {secondaryPage && (
          <section role="tabpanel" id={`${titleId}-secondary-panel`} aria-labelledby={`${titleId}-secondary-tab`} hidden={!showSecondary}>
            {secondaryPage.content}
          </section>
        )}
      </div>
    </dialog>
  )
}
