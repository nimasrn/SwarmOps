import { Badge } from '@nim.zone/ui'
import type { BadgeVariant } from '@nim.zone/ui'
import type { Command } from '../data/types'
import { capitalize, sentence } from '../lib/format'

/**
 * State, in words, everywhere it is shown.
 *
 * This console's accent is malachite, so green means "primary action" as well
 * as "healthy" and a coloured dot can never be the whole claim. Both badges
 * here always render the WORD beside the colour — greyscale, print, and a
 * screenshot pasted into an incident channel all have to survive it.
 */

export function StatusBadge({ health, label }: { health: string; label?: string }) {
  const variant: BadgeVariant = health === 'healthy'
    ? 'success'
    : health === 'unhealthy'
      ? 'danger'
      : health === 'degraded'
        ? 'warning'
        : 'neutral'
  return <Badge dot pill size="sm" tone="soft" variant={variant}>{label ?? capitalize(health)}</Badge>
}

export function CommandStateBadge({ state }: { state: Command['state'] }) {
  const variant: BadgeVariant = state === 'succeeded'
    ? 'success'
    : state === 'failed' || state === 'needs_attention'
      ? 'danger'
      : state === 'retry_scheduled'
        ? 'warning'
        : state === 'leased' || state === 'preparing' || state === 'running'
          ? 'accent'
          : 'neutral'
  return <Badge dot pill size="sm" tone="soft" variant={variant}>{sentence(state)}</Badge>
}
