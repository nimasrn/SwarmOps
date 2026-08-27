import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { IconButton } from '@/components/icon-button'
import { cn } from '@/lib/cn'

export interface SheetProps {
  children: ReactNode
  className?: string
  /** Label for the close control; also names the dialog when no title is set. */
  closeLabel?: string
  footer?: ReactNode
  onClose: () => void
  open: boolean
  title?: ReactNode
}

/**
 * The bottom sheet is nim's modal surface. It owns the three things that are
 * always forgotten in hand-rolled sheets: the page behind it must not scroll,
 * Escape must close it, and focus must move into it on open and be restorable
 * on close.
 */
export function Sheet({ children, className, closeLabel = 'Close', footer, onClose, open, title }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return

    restoreRef.current = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab') return
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable?.length) {
        event.preventDefault()
        panelRef.current?.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
      restoreRef.current?.focus?.()
    }
  }, [onClose, open])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <>
      <div className="nim-sheet__scrim" onClick={onClose} />
      <div
        aria-label={title ? undefined : closeLabel}
        aria-labelledby={title ? titleId : undefined}
        aria-modal="true"
        className={cn('nim-sheet__panel', className)}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <span aria-hidden="true" className="nim-sheet__handle" />
        {title ? (
          <div className="nim-sheet__header">
            <p className="nim-title nim-title--md" id={titleId}>{title}</p>
            <IconButton label={closeLabel} name="close" onClick={onClose} size="sm" />
          </div>
        ) : null}
        <div className="nim-sheet__body">{children}</div>
        {footer ? <div className="nim-sheet__footer">{footer}</div> : null}
      </div>
    </>,
    document.body,
  )
}
