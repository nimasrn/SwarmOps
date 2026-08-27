import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface AvatarRingProps {
  className?: string
  /** What the ring is measuring, for assistive tech. */
  label: string
  /** Initials, or a small caption under them. */
  caption?: ReactNode
  /** Image URL. Falls back to `initials` when absent or broken. */
  src?: string
  initials: string
  size?: number
  /** 0–100. The ring is the progress; the number belongs in the caption. */
  value: number
}

/**
 * An avatar wearing a progress ring: profile completion, a skin score, a
 * streak — one figure the viewer is meant to want to finish.
 *
 * The ring is an SVG arc rather than a conic gradient so it keeps a rounded
 * cap and stays crisp at any size, and it carries `role="img"` with the label,
 * because the arc is the only place the value is stated for a sighted viewer.
 */
export function AvatarRing({
  caption,
  className,
  initials,
  label,
  size = 96,
  src,
  value,
}: AvatarRingProps) {
  const stroke = Math.max(4, Math.round(size * 0.05))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const filled = (Math.min(100, Math.max(0, value)) / 100) * circumference

  return (
    <div
      aria-label={label}
      className={cn('nim-avatar-ring', className)}
      role="img"
      style={{ '--nim-ring-size': `${size}px`, '--nim-ring-stroke': `${stroke}px` } as CSSProperties}
    >
      <svg aria-hidden="true" className="nim-avatar-ring__arc" viewBox={`0 0 ${size} ${size}`}>
        <circle
          className="nim-avatar-ring__track"
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          strokeWidth={stroke}
        />
        <circle
          className="nim-avatar-ring__fill"
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          strokeWidth={stroke}
        />
      </svg>
      <span className="nim-avatar-ring__face">
        {src ? (
          <img alt="" className="nim-avatar-ring__image" src={src} />
        ) : (
          <span className="nim-avatar-ring__initials">{initials}</span>
        )}
        {caption && !src ? <span className="nim-avatar-ring__caption">{caption}</span> : null}
      </span>
    </div>
  )
}

export interface ProfileHeaderProps {
  /** The row of quick figures under the identity block. */
  stats?: { label: ReactNode; value: ReactNode }[]
  /** Small pills: plan, skin type, billing cycle. */
  chips?: ReactNode
  actions?: ReactNode
  avatar: ReactNode
  className?: string
  /** The line above the name — "vlora account", the tenant, the role. */
  eyebrow?: ReactNode
  name: ReactNode
}

/**
 * The plate at the top of a profile: who this is, what they have, and the two
 * things they should do next.
 *
 * It is a header, not a dashboard. Anything that needs a chart or a list goes
 * in the sections beneath it — this block stays readable at a glance, which is
 * the only reason it earns the space it takes.
 */
export function ProfileHeader({
  actions,
  avatar,
  chips,
  className,
  eyebrow,
  name,
  stats = [],
}: ProfileHeaderProps) {
  return (
    <section className={cn('nim-profile-header', className)}>
      <div className="nim-profile-header__identity">
        {avatar}
        <div className="nim-profile-header__who">
          {eyebrow ? <p className="nim-profile-header__eyebrow">{eyebrow}</p> : null}
          <h1 className="nim-profile-header__name">{name}</h1>
          {chips ? <div className="nim-profile-header__chips">{chips}</div> : null}
        </div>
      </div>

      {stats.length ? (
        <dl className="nim-profile-header__stats">
          {stats.map((stat, index) => (
            <div className="nim-profile-header__stat" key={index}>
              <dt className="nim-profile-header__stat-label">{stat.label}</dt>
              <dd className="nim-profile-header__stat-value">{stat.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {actions ? <div className="nim-profile-header__actions">{actions}</div> : null}
    </section>
  )
}
