import { Button, Menu } from '@nim.zone/ui'
import type { MenuItem } from '@nim.zone/ui'
import type { AttentionItem } from '../lib/attention'
import type { WorkspacePage } from '../navigation/navigation'

/**
 * What needs a decision, from anywhere in the console.
 *
 * The overview screen has always listed this; the problem was that an operator
 * who went straight to Traffic never saw it. Attention that only exists on one
 * screen is attention that arrives late, so the same array now also hangs off
 * the masthead — and every row opens the screen that can actually resolve it,
 * rather than the screen that noticed it.
 *
 * It is a labelled button rather than a dot on an icon for the reason that
 * governs this whole console: the accent is malachite, so colour alone cannot
 * carry a status, and "2 need a decision" survives greyscale, a screenshot, and
 * a reader who has never seen the control before. When nothing is open the
 * control is absent entirely — an empty state in the chrome is a thing to read
 * and dismiss on every screen, forever.
 */
export function AttentionMenu({ items, onOpen }: { items: AttentionItem[]; onOpen: (page: WorkspacePage) => void }) {
  if (!items.length) return null

  const blocking = items.filter((item) => item.tone === 'danger').length
  const label = `${items.length} thing${items.length === 1 ? '' : 's'} need${items.length === 1 ? 's' : ''} a decision`

  const menuItems: MenuItem[] = [
    { kind: 'heading', label: blocking ? `${blocking} blocking · ${items.length - blocking} to review` : 'To review' },
    ...items.map((item): MenuItem => ({
      icon: item.tone === 'danger' ? 'alert' : 'activity',
      label: item.label,
      onSelect: () => onOpen(item.page),
    })),
    { kind: 'separator' },
    { icon: 'activity', label: 'Open runs', onSelect: () => onOpen('runs') },
  ]

  return (
    <Menu items={menuItems} label={label}>
      {({ ref, toggle }) => (
        <Button iconStart={blocking ? 'alert' : 'activity'} onClick={toggle} ref={ref} size="sm" variant={blocking ? 'danger' : 'secondary'}>
          {items.length} to decide
        </Button>
      )}
    </Menu>
  )
}
