import { Badge } from '@nim.zone/ui'
import type { BadgeVariant } from '@nim.zone/ui'

const VARIANTS: Record<string, BadgeVariant> = {
  active: 'success',
  answered: 'info',
  cancelled: 'neutral',
  closed: 'neutral',
  deleted: 'neutral',
  failed: 'danger',
  open: 'warning',
  paid: 'success',
  pending: 'warning',
  provisioning: 'info',
  rejected: 'danger',
  suspended: 'danger',
}

/** Every Sales status says its state in words beside the colour. */
export function OrderStatus({ status }: { status: string }) {
  return <Badge dot variant={VARIANTS[status] ?? 'neutral'}>{status}</Badge>
}
