import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

export interface AnchorPosition {
  left: number
  top: number
}

export interface UseAnchorOptions {
  /** Called when the viewer asks to dismiss: Escape, or a click outside. */
  onDismiss: () => void
  open: boolean
}

/**
 * Anchored overlay placement, shared by Menu and Popover.
 *
 * Deliberately small: nim does not ship a floating-element engine. It places
 * the panel under the trigger, flips it above when the space below cannot hold
 * it, and clamps it inside the viewport. Anything needing collision detection
 * against scroll containers wants a real positioning library, not this.
 *
 * It also owns the two dismissals every overlay must honour and hand-rolled
 * ones always forget: Escape, and a pointer landing outside both elements.
 */
export function useAnchor<T extends HTMLElement, P extends HTMLElement>(
  triggerRef: RefObject<T | null>,
  panelRef: RefObject<P | null>,
  { onDismiss, open }: UseAnchorOptions,
) {
  const [position, setPosition] = useState<AnchorPosition>({ left: 0, top: 0 })
  const restoreRef = useRef<HTMLElement | null>(null)

  const place = useCallback(() => {
    const trigger = triggerRef.current
    const panel = panelRef.current
    if (!trigger || !panel) return

    const anchor = trigger.getBoundingClientRect()
    const { height, width } = panel.getBoundingClientRect()
    const gap = 4
    const margin = 8
    const rtl = getComputedStyle(trigger).direction === 'rtl'

    const below = anchor.bottom + gap
    const flip = below + height > window.innerHeight && anchor.top - gap - height > 0
    const top = flip ? anchor.top - gap - height : below

    const preferred = rtl ? anchor.right - width : anchor.left
    const left = Math.min(Math.max(preferred, margin), window.innerWidth - width - margin)

    setPosition({ left, top })
  }, [panelRef, triggerRef])

  useLayoutEffect(() => {
    if (!open) return
    place()
  }, [open, place])

  useEffect(() => {
    if (!open) return

    restoreRef.current = document.activeElement as HTMLElement | null

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onDismiss()
      }
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      onDismiss()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      restoreRef.current?.focus?.()
    }
  }, [onDismiss, open, panelRef, place, triggerRef])

  return position
}
