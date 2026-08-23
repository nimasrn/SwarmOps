import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/components/icon'
import { cn } from '@/lib/cn'

export type ToastTone = 'accent' | 'danger' | 'neutral' | 'success'

export interface ToastOptions {
  action?: { label: string; onPress: () => void }
  /** Milliseconds on screen. Pass 0 to require a manual dismissal. */
  duration?: number
  message: string
  tone?: ToastTone
}

interface ToastRecord extends ToastOptions {
  id: number
}

const ToastContext = createContext<((options: ToastOptions) => void) | null>(null)

const TONE_ICON: Record<ToastTone, IconName> = {
  accent: 'sparkle',
  danger: 'danger',
  neutral: 'info',
  success: 'check-circle',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback(
    (options: ToastOptions) => {
      const id = nextId.current++
      setToasts((current) => [...current, { ...options, id }])
      const duration = options.duration ?? 4000
      if (duration > 0) window.setTimeout(() => dismiss(id), duration)
    },
    [dismiss],
  )

  const value = useMemo(() => push, [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined'
        ? createPortal(
            <div aria-live="polite" className="nim-toast-stack">
              {toasts.map((toast) => (
                <div className={cn('nim-toast', `nim-toast--${toast.tone ?? 'neutral'}`)} key={toast.id}>
                  <Icon className="nim-toast__icon" name={TONE_ICON[toast.tone ?? 'neutral']} size="sm" />
                  <span className="nim-toast__message">{toast.message}</span>
                  {toast.action ? (
                    <button
                      className="nim-toast__action"
                      onClick={() => {
                        toast.action?.onPress()
                        dismiss(toast.id)
                      }}
                      type="button"
                    >
                      {toast.action.label}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  )
}

/** Throws when used outside the provider — a silent no-op would hide the bug. */
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside <ToastProvider>')
  return context
}
