import { describe, expect, it } from 'vitest'
import { createDialogBackdropGuard } from '../src/hooks/use-dialog-backdrop'

const pointer = (pointerId = 1, button = 0, isPrimary = true) => ({ pointerId, button, isPrimary })

describe('dialog backdrop dismissal', () => {
  it.each([
    { startOutside: false, endOutside: true, closes: false, gesture: 'dragging from content onto the backdrop' },
    { startOutside: true, endOutside: false, closes: false, gesture: 'dragging from the backdrop into content' },
    { startOutside: false, endOutside: false, closes: false, gesture: 'clicking within the dialog bounds' },
    { startOutside: true, endOutside: true, closes: true, gesture: 'pressing and releasing on the backdrop' },
  ])('$gesture', ({ startOutside, endOutside, closes }) => {
    const guard = createDialogBackdropGuard()
    guard.pointerDown(pointer(), startOutside)
    guard.pointerUp(pointer(), endOutside)
    expect(guard.consumeClick()).toBe(closes)
  })

  it('requires a matching primary left pointer', () => {
    for (const [down, up] of [
      [pointer(1, 2), pointer(1, 2)],
      [pointer(1, 1), pointer(1, 1)],
      [pointer(1), pointer(2)],
      [pointer(1, 0, false), pointer(1, 0, false)],
    ]) {
      const guard = createDialogBackdropGuard()
      guard.pointerDown(down, true)
      guard.pointerUp(up, true)
      expect(guard.consumeClick()).toBe(false)
    }
  })

  it('does not reuse a completed gesture or accept a click without pointer input', () => {
    const guard = createDialogBackdropGuard()
    expect(guard.consumeClick()).toBe(false)
    guard.pointerUp(pointer(), true)
    expect(guard.consumeClick()).toBe(false)
    guard.pointerDown(pointer(), true)
    guard.pointerUp(pointer(), true)
    expect(guard.consumeClick()).toBe(true)
    expect(guard.consumeClick()).toBe(false)
    guard.pointerDown(pointer(), false)
    guard.pointerUp(pointer(), true)
    expect(guard.consumeClick()).toBe(false)
  })

  it('cancels incomplete gestures and permits the next real outside click', () => {
    const guard = createDialogBackdropGuard()
    guard.pointerDown(pointer(), true)
    guard.cancel()
    guard.pointerUp(pointer(), true)
    expect(guard.consumeClick()).toBe(false)
    guard.pointerDown(pointer(), true)
    guard.pointerUp(pointer(), true)
    guard.cancel()
    expect(guard.consumeClick()).toBe(false)
    guard.pointerDown(pointer(), true)
    guard.pointerUp(pointer(), true)
    expect(guard.consumeClick()).toBe(true)
  })

  it('does not dismiss during a multi-pointer gesture', () => {
    const guard = createDialogBackdropGuard()
    guard.pointerDown(pointer(1), true)
    guard.pointerDown(pointer(2, 0, false), true)
    guard.pointerUp(pointer(2, 0, false), true)
    guard.pointerUp(pointer(1), true)
    expect(guard.consumeClick()).toBe(false)
  })
})
