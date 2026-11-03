import { useRef, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react'

type BackdropPointer = Pick<PointerEvent, 'pointerId' | 'button' | 'isPrimary'>

export function createDialogBackdropGuard() {
  let pressedOutside: number | null = null
  let dismiss = false
  return {
    pointerDown(event: BackdropPointer, outside: boolean) {
      dismiss = false
      pressedOutside = outside && event.isPrimary && event.button === 0 ? event.pointerId : null
    },
    pointerUp(event: BackdropPointer, outside: boolean) {
      dismiss = outside && event.isPrimary && event.button === 0 && event.pointerId === pressedOutside
      pressedOutside = null
    },
    cancel() { pressedOutside = null; dismiss = false },
    consumeClick() {
      const result = dismiss
      dismiss = false
      return result
    },
  }
}

function outsideDialog(event: ReactPointerEvent<HTMLDialogElement>) {
  const bounds = event.currentTarget.getBoundingClientRect()
  return event.clientX < bounds.left || event.clientX >= bounds.right || event.clientY < bounds.top || event.clientY >= bounds.bottom
}

export function useDialogBackdrop() {
  const guard = useRef<ReturnType<typeof createDialogBackdropGuard> | null>(null)
  guard.current ??= createDialogBackdropGuard()
  const state = guard.current
  return {
    // Native dialog clicks can target the dialog after a drag that began inside it.
    onPointerDownCapture: (event: ReactPointerEvent<HTMLDialogElement>) => state.pointerDown(event, outsideDialog(event)),
    onPointerUpCapture: (event: ReactPointerEvent<HTMLDialogElement>) => state.pointerUp(event, outsideDialog(event)),
    onPointerCancelCapture: state.cancel,
    onClick: (event: MouseEvent<HTMLDialogElement>) => {
      const dismiss = state.consumeClick()
      if (dismiss && event.button === 0 && event.target === event.currentTarget) event.currentTarget.close()
    },
  }
}
