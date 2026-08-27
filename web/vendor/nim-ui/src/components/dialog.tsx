import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { IconButton } from '@/components/icon-button'
import { cn } from '@/lib/cn'

export interface DialogProps {
  children: ReactNode
  className?: string
  closeLabel?: string
  description?: ReactNode
  /** Keeps an in-flight, irreversible action from being dismissed. */
  dismissible?: boolean
  footer?: ReactNode
  onClose: () => void
  open: boolean
  title: ReactNode
}

/**
 * The centred modal, for a decision that has to be made now. The Sheet remains
 * nim's mobile-first surface; this is what a desktop confirmation wants.
 *
 * It renders a real `<dialog>` opened with `showModal()`, so the top layer,
 * the focus trap, the inert background and Escape all come from the platform
 * rather than from a scrim div and a keydown listener.
 */
export function Dialog({
  children,
  className,
  closeLabel = 'Close',
  description,
  dismissible = true,
  footer,
  onClose,
  open,
  title,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return

    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog || dismissible) return

    // Escape fires `cancel` before the browser closes a native dialog. Keep
    // controlled state and the platform surface in sync while a caller has
    // deliberately made its action non-dismissible.
    const preventEscape = (event: Event) => event.preventDefault()
    dialog.addEventListener('cancel', preventEscape)
    return () => dialog.removeEventListener('cancel', preventEscape)
  }, [dismissible])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return

    // `close` fires for Escape and for the platform's own dismissals, so the
    // caller's state stays in step without a second key listener.
    const onCancel = () => onClose()
    dialog.addEventListener('close', onCancel)
    return () => dialog.removeEventListener('close', onCancel)
  }, [onClose])

  return (
    <dialog
      className={cn('nim-dialog', className)}
      onClick={(event) => {
        // A click landing on the dialog element itself is a click on the
        // backdrop — the children cover the rest of its box.
        if (dismissible && event.target === ref.current) onClose()
      }}
      ref={ref}
    >
      <div className="nim-dialog__header">
        <div>
          <p className="nim-title nim-title--md">{title}</p>
          {description ? <p className="nim-caption">{description}</p> : null}
        </div>
        {dismissible ? <IconButton label={closeLabel} name="close" onClick={onClose} size="sm" /> : null}
      </div>
      <div className="nim-dialog__body">{children}</div>
      {footer ? <div className="nim-dialog__footer">{footer}</div> : null}
    </dialog>
  )
}
