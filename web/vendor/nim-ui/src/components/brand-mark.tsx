import type { SVGProps } from 'react'
import { cn } from '@/lib/cn'

/**
 * The third-party marks a delivery console has to name: the forge a repository
 * came from, the engine a dependency will become, the stack a signal will be
 * reconciled into.
 *
 * These are NOT icons. `Icon` is a closed set addressed by ROLE — "database",
 * "package" — precisely so two screens cannot mean "delete" with two glyphs.
 * A brand mark means one specific product and nothing else, so it lives in its
 * own registry with its own rule: a mark is only ever drawn beside the name it
 * belongs to, never as a decoration and never as the sole identifier of a row.
 *
 * Each is a simplified, single-purpose rendering at UI scale, tinted with the
 * project's own colour so a row of dependencies is scannable by shape AND hue.
 * They are used nominatively — to name the software being deployed — and carry
 * no endorsement claim; a product that needs an exact trademark lockup should
 * ship the vendor's own asset instead.
 */
export type BrandName =
  | 'gitea'
  | 'github'
  | 'gitlab'
  | 'grafana'
  | 'jaeger'
  | 'loki'
  | 'mongodb'
  | 'postgresql'
  | 'prometheus'
  | 'redis'
  | 'valkey'

export type BrandMarkSize = 'sm' | 'md' | 'lg'

export interface BrandMarkProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  /** Names the mark for assistive tech when it stands alone. Beside the
      product's own name — which is the only place it should be — leave it
      unset and the mark is hidden, because the name is already the label. */
  label?: string
  name: BrandName
  size?: BrandMarkSize
}

const TINT: Record<BrandName, string> = {
  gitea: '#609926',
  github: 'currentColor',
  gitlab: '#e24329',
  grafana: '#f46800',
  jaeger: '#60d0e4',
  loki: '#f9c916',
  mongodb: '#4faa41',
  postgresql: '#31648c',
  prometheus: '#e6522c',
  redis: '#d82c20',
  valkey: '#ff4438',
}

/* Every mark is drawn inside the same 24-unit box, so a column of them shares
   one optical size without per-mark nudging. */
const PATHS: Record<BrandName, JSX.Element> = {
  gitea: (
    <>
      <path d="M7 4h7a6 6 0 0 1 0 12h-2" />
      <circle cx="7" cy="8" r="3" />
      <path d="M12 16v4" />
    </>
  ),
  github: (
    <path d="M12 2.6a9.4 9.4 0 0 0-3 18.3c.5.1.6-.2.6-.5v-1.7c-2.6.6-3.2-1.2-3.2-1.2-.4-1.1-1-1.4-1-1.4-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.8.8.1-.6.3-1.1.6-1.3-2.1-.2-4.3-1-4.3-4.6 0-1 .4-1.9 1-2.5-.1-.3-.4-1.3.1-2.6 0 0 .8-.3 2.6 1a9 9 0 0 1 4.8 0c1.8-1.3 2.6-1 2.6-1 .5 1.3.2 2.3.1 2.6.6.6 1 1.5 1 2.5 0 3.6-2.2 4.4-4.3 4.6.3.3.6.9.6 1.8v2.7c0 .3.2.6.7.5A9.4 9.4 0 0 0 12 2.6Z" />
  ),
  gitlab: <path d="m12 21-3.5-10.8H3.3L12 21l8.7-10.8h-5.2L12 21ZM8.5 10.2 6.6 4l-3.3 6.2h5.2Zm7 0L17.4 4l3.3 6.2h-5.2Z" />,
  grafana: (
    <>
      <circle cx="12" cy="13" r="5" />
      <path d="M12 4v4M6 6l2 3M18 6l-2 3" />
    </>
  ),
  jaeger: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  loki: (
    <>
      <path d="M12 3 5 9v9h14V9l-7-6Z" />
      <path d="M9 18v-5h6v5" />
    </>
  ),
  mongodb: <path d="M12 2.5c2.6 3.2 5 6 5 10 0 3.4-2.2 6.2-4.3 7.1L12 22l-.7-2.4C9.2 18.7 7 15.9 7 12.5c0-4 2.4-6.8 5-10Z" />,
  postgresql: (
    <>
      <ellipse cx="12" cy="7" rx="7" ry="3.2" />
      <path d="M5 7v9c0 1.8 3.1 3.2 7 3.2s7-1.4 7-3.2V7" />
      <path d="M5 12c0 1.8 3.1 3.2 7 3.2s7-1.4 7-3.2" />
    </>
  ),
  prometheus: (
    <>
      <path d="M12 2c2.6 2.8 3.6 5 2.6 7.4C13.8 11.2 12 11.8 12 14" />
      <circle cx="12" cy="14" r="7" />
      <path d="M8 12h8" />
    </>
  ),
  redis: (
    <>
      <path d="m12 3 9 4-9 4-9-4 9-4Z" />
      <path d="m3 12 9 4 9-4M3 17l9 4 9-4" />
    </>
  ),
  valkey: (
    <>
      <path d="m12 3 9 4-9 4-9-4 9-4Z" />
      <path d="m3 12 9 4 9-4" />
    </>
  ),
}

const FILLED = new Set<BrandName>(['github', 'gitlab', 'mongodb'])

const SIZE: Record<BrandMarkSize, number> = { lg: 32, md: 24, sm: 20 }

export function BrandMark({ className, label, name, size = 'md', ...props }: BrandMarkProps) {
  const filled = FILLED.has(name)
  const box = SIZE[size]

  return (
    <svg
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn('nim-brand-mark', className)}
      fill={filled ? 'currentColor' : 'none'}
      height={box}
      role={label ? 'img' : undefined}
      stroke={filled ? 'none' : 'currentColor'}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.6}
      style={{ color: TINT[name] }}
      viewBox="0 0 24 24"
      width={box}
      {...props}
    >
      {PATHS[name]}
    </svg>
  )
}

/** The mark for a dependency named the way a Compose file names it. Returns
    `undefined` when nothing in the registry matches, which is the caller's
    signal to fall back to a role icon rather than guess. */
export function brandFor(value: string): BrandName | undefined {
  const key = value.toLowerCase()
  const table: Record<string, BrandName> = {
    forgejo: 'gitea',
    gitea: 'gitea',
    github: 'github',
    gitlab: 'gitlab',
    grafana: 'grafana',
    jaeger: 'jaeger',
    loki: 'loki',
    mongo: 'mongodb',
    mongodb: 'mongodb',
    postgres: 'postgresql',
    postgresql: 'postgresql',
    prometheus: 'prometheus',
    redis: 'redis',
    valkey: 'valkey',
  }
  return table[key]
}
