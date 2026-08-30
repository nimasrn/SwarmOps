import { useState } from 'react'
import type { ReactNode } from 'react'
import { Banner, Button, CopyChip, Inline, Input, Stack as Rows } from '@nim.zone/ui'
import type { ButtonVariant } from '@nim.zone/ui'

export interface ConfirmPhraseProps {
  /** The button, once the phrase matches. */
  action: string
  busy?: boolean
  /** Row shape: a quiet button that opens the field, for a table cell where a
      permanent confirmation form would be six of them stacked. */
  compact?: boolean
  /** What this actually does, in one sentence, before it is done. Required in
      the full shape; a compact row is already labelled by its own row. */
  consequence?: ReactNode
  disabled?: boolean
  label?: string
  onConfirm: (phrase: string) => Promise<void> | void
  /** The exact string the operator has to type. */
  phrase: string
  variant?: ButtonVariant
}

/**
 * The console's one way of asking "are you certain".
 *
 * Eleven screens had written this by hand — an `Input`, a `Button`, and a
 * comparison — and they had drifted in the way that matters: some stated the
 * consequence, some only named the phrase; most disabled the button until the
 * phrase matched, one enabled it and let the server refuse instead.
 *
 * The phrase is SHOWN and copyable rather than hidden. The friction that makes
 * this gate work is deliberation, not recall: an operator who cannot see what
 * to type either gives up or guesses, and neither is the pause the gate exists
 * to create. The consequence sits above the field for the same reason — it is
 * the sentence the decision is actually made on.
 */
export function ConfirmPhrase({
  action,
  busy,
  compact,
  consequence,
  disabled,
  label = 'Confirmation',
  onConfirm,
  phrase,
  variant = 'danger',
}: ConfirmPhraseProps) {
  const [typed, setTyped] = useState('')
  const [open, setOpen] = useState(false)
  const matched = typed.trim() === phrase

  const confirm = async () => {
    await onConfirm(typed.trim())
    setTyped('')
    setOpen(false)
  }

  if (compact && !open) {
    return <Button onClick={() => setOpen(true)} size="sm" variant="ghost">{action}</Button>
  }

  return (
    <Rows gap="tight">
      {consequence && !compact ? <Banner title="Confirm before this runs" tone="warning">{consequence}</Banner> : null}
      {!compact ? <CopyChip copyLabel="Copy the confirmation phrase">{phrase}</CopyChip> : null}
      <Input
        autoComplete="off"
        hint={`Type ${phrase} exactly. Nothing is queued until it matches.`}
        label={label}
        onChange={(event) => setTyped(event.target.value)}
        placeholder={phrase}
        spellCheck={false}
        value={typed}
      />
      <Inline gap="tight">
        <Button disabled={disabled || busy || !matched} loading={busy} onClick={() => void confirm()} variant={variant}>{action}</Button>
        {compact ? <Button onClick={() => { setOpen(false); setTyped('') }} size="sm" variant="ghost">Cancel</Button> : null}
      </Inline>
    </Rows>
  )
}
