import type { HTMLAttributes, ReactNode } from 'react'
import { Icon, type IconName } from '@/components/icon'
import { cn } from '@/lib/cn'

export type BannerTone = 'accent' | 'danger' | 'info' | 'neutral' | 'success' | 'warning'

export interface BannerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  action?: ReactNode
  children: ReactNode
  icon?: IconName
  title?: ReactNode
  tone?: BannerTone
}

const DEFAULT_ICON: Record<BannerTone, IconName> = {
  accent: 'sparkle',
  danger: 'danger',
  info: 'info',
  neutral: 'info',
  success: 'check-circle',
  warning: 'alert',
}

export function Banner({
  action,
  children,
  className,
  icon,
  title,
  tone = 'neutral',
  ...props
}: BannerProps) {
  return (
    <div
      className={cn('nim-banner', `nim-banner--${tone}`, className)}
      role={tone === 'danger' ? 'alert' : 'status'}
      {...props}
    >
      <Icon className="nim-banner__icon" name={icon ?? DEFAULT_ICON[tone]} size="sm" />
      <div className="nim-banner__content">
        {title ? <p className="nim-banner__title">{title}</p> : null}
        <div>{children}</div>
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  )
}
