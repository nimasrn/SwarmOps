import { useCallback, useEffect, useRef } from 'react'
import type { ClipboardEvent, KeyboardEvent } from 'react'
import { cn } from '@/lib/cn'
import { toAsciiDigits } from '@/lib/countries'

export interface OtpInputProps {
  /** Fires as soon as the last box is filled — by typing, pasting, or SMS
      autofill. The caller does not need to watch `value.length` itself. */
  autoFocus?: boolean
  className?: string
  error?: string
  label: string
  length?: number
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  /** Per-box accessible name, e.g. `(i) => `Digit ${i + 1}``. */
  digitLabel?: (index: number) => string
  /** The code so far, ASCII digits only, shorter than `length` while typing. */
  value: string
}

/**
 * The boxed one-time code.
 *
 * One `<input>` per digit, but the string is the caller's: the component never
 * holds a per-box array, so a paste, an SMS autofill, and a keystroke all take
 * the same path and cannot disagree. The row is pinned `dir="ltr"` even inside
 * a Persian page — a code is a number, and the first digit belongs on the left
 * in every script. Input is normalised through `toAsciiDigits`, so ۱۲۳۴۵ typed
 * on a Persian keyboard arrives as `12345`.
 *
 * `autocomplete="one-time-code"` on the first box is what lets iOS and Android
 * offer the code from the SMS itself.
 */
export function OtpInput({
  autoFocus = false,
  className,
  digitLabel,
  error,
  label,
  length = 5,
  onChange,
  onComplete,
  value,
}: OtpInputProps) {
  const root = useRef<HTMLDivElement>(null)
  const digits = value.slice(0, length).split('')

  const focusBox = useCallback((index: number) => {
    const boxes = root.current?.querySelectorAll<HTMLInputElement>('input')
    boxes?.[Math.max(0, Math.min(index, boxes.length - 1))]?.focus()
  }, [])

  useEffect(() => {
    if (autoFocus) focusBox(0)
  }, [autoFocus, focusBox])

  const commit = useCallback(
    (next: string, caret: number) => {
      const trimmed = next.slice(0, length)
      onChange(trimmed)
      if (trimmed.length === length) onComplete?.(trimmed)
      else focusBox(caret)
    },
    [focusBox, length, onChange, onComplete],
  )

  const handleInput = useCallback(
    (index: number, raw: string) => {
      const typed = toAsciiDigits(raw)
      if (!typed) return
      // A box can receive more than one digit — a paste into the middle, or a
      // keyboard suggestion. Write from here and let the rest overflow right.
      const next = (value.slice(0, index) + typed).slice(0, length)
      commit(next, next.length)
    },
    [commit, length, value],
  )

  const handleKeyDown = useCallback(
    (index: number, event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Backspace') {
        event.preventDefault()
        // Backspace on an empty box deletes the digit before it, which is the
        // behaviour a viewer expects from what looks like one field.
        const target = value[index] ? index : index - 1
        if (target < 0) return
        onChange(value.slice(0, target) + value.slice(target + 1))
        focusBox(target)
      } else if (event.key === 'ArrowLeft') {
        focusBox(index - 1)
      } else if (event.key === 'ArrowRight') {
        focusBox(index + 1)
      }
    },
    [focusBox, onChange, value],
  )

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      const pasted = toAsciiDigits(event.clipboardData.getData('text'))
      if (!pasted) return
      event.preventDefault()
      commit(pasted.slice(0, length), pasted.length)
    },
    [commit, length],
  )

  return (
    <div className={cn('nim-otp', error && 'nim-otp--invalid', className)}>
      <div
        aria-label={label}
        className="nim-otp__boxes"
        dir="ltr"
        onPaste={handlePaste}
        ref={root}
        role="group"
      >
        {Array.from({ length }, (_, index) => (
          <input
            aria-invalid={error ? true : undefined}
            aria-label={digitLabel ? digitLabel(index) : `${label} ${index + 1}`}
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            className="nim-otp__box"
            data-filled={digits[index] ? 'true' : undefined}
            enterKeyHint="done"
            inputMode="numeric"
            key={index}
            onChange={(event) => handleInput(index, event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            onKeyDown={(event) => handleKeyDown(index, event)}
            type="text"
            value={digits[index] ?? ''}
          />
        ))}
      </div>
      {error ? (
        <p className="nim-otp__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
