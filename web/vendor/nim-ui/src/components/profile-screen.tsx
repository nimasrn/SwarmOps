import type { ReactNode } from 'react'
import { List, ListRow } from '@/components/list'
import { ProfileHeader, type ProfileHeaderProps } from '@/components/profile-header'
import { SectionHeader } from '@/components/section-header'
import { Switch } from '@/components/choice'
import { cn } from '@/lib/cn'
import type { IconName } from '@/components/icon'
import { Icon } from '@/components/icon'

export interface ProfileRow {
  /** A switch instead of a chevron. With `onToggle` the row is the control. */
  checked?: boolean
  danger?: boolean
  href?: string
  icon?: IconName
  key: string
  label: ReactNode
  onSelect?: () => void
  onToggle?: (next: boolean) => void
  subtitle?: ReactNode
  /** A badge, a count, a version string. */
  value?: ReactNode
}

export interface ProfileSection {
  description?: ReactNode
  key: string
  rows: ProfileRow[]
  title?: ReactNode
}

export interface ProfileScreenProps extends ProfileHeaderProps {
  className?: string
  /** Sign out, delete account — whatever ends the session, kept away from the
      rows above so it is never the thing a thumb reaches by accident. */
  footer?: ReactNode
  sections?: ProfileSection[]
}

/**
 * The account screen: the identity plate, then grouped rows of settings.
 *
 * Ready to mount — hand it the header's props and a list of sections and it is
 * the screen. Rows are declared, not composed, so the whole of a settings page
 * is data the app already has: a label, an icon, and either somewhere to go or
 * something to toggle.
 *
 * State stays the caller's. A switch here reports the change and redraws from
 * the prop, because the truth about whether notifications are on lives on a
 * server, and a row that flips optimistically and then disagrees with it is
 * worse than one that waits.
 */
export function ProfileScreen({
  className,
  footer,
  sections = [],
  ...header
}: ProfileScreenProps) {
  return (
    <div className={cn('nim-profile-screen', className)}>
      <ProfileHeader {...header} />

      {sections.map((section) => (
        <section className="nim-profile-screen__section" key={section.key}>
          {section.title ? (
            <SectionHeader description={section.description} title={section.title} />
          ) : null}
          <List>
            {section.rows.map((row) => (
              <ListRow
                className={cn(row.danger && 'nim-list-row--danger')}
                href={row.href}
                key={row.key}
                leading={row.icon ? <Icon name={row.icon} size="md" /> : undefined}
                onClick={row.onToggle ? undefined : row.onSelect}
                subtitle={row.subtitle}
                title={row.label}
                trailing={
                  row.onToggle ? (
                    // The row's own title names the switch, so the control
                    // carries the name rather than repeating the text beside
                    // itself. A toggle row is a div, never a button — a switch
                    // inside a button is two controls in one target.
                    <Switch
                      aria-label={typeof row.label === 'string' ? row.label : undefined}
                      checked={row.checked ?? false}
                      onChange={(event) => row.onToggle?.(event.target.checked)}
                    >
                      {''}
                    </Switch>
                  ) : row.value !== undefined ? (
                    <span className="nim-profile-screen__value">{row.value}</span>
                  ) : undefined
                }
              />
            ))}
          </List>
        </section>
      ))}

      {footer ? <div className="nim-profile-screen__footer">{footer}</div> : null}
    </div>
  )
}
