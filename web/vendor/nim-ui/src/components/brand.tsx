import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type BrandSize = 'lg' | 'md' | 'sm'

export interface BrandProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** Makes the lockup the link home. A brand that is a link everywhere except
      one screen is the kind of inconsistency people report as a bug. */
  href?: string
  /** The product's mark, at whatever size it draws itself. The kit does not
      scale it: a mark is geometry its owner tuned, and a lockup that rescales
      it turns a hairline into a smudge. */
  mark?: ReactNode
  name: ReactNode
  /** A second run after the name, taking `--nim-brand-accent`. The two-tone
      wordmark — "Swarm" + "Ops" — without the product reaching for a literal
      colour: it sets one custom property and the kit owns the type. */
  nameAccent?: ReactNode
  size?: BrandSize
  /** One line under the name. Dropped where the name alone identifies the
      product — a topbar, a collapsed rail — rather than truncated to three
      words, which reads as a bug. */
  tagline?: ReactNode
}

/**
 * A product's mark, wordmark and tagline, locked up.
 *
 * Every console in this family had written this: a flex row, a mark box, a
 * `<strong>` and a `<small>` — swarmops in its app CSS, vlora-admin in its
 * own, and the two did not agree on the gap, the tagline colour, or whether
 * the name was a title or a body run. It is one component now, so a product's
 * identity is the same object in the sidebar, on the sign-in screen and in a
 * drawer, and cannot drift between them.
 *
 * The wordmark is set in the display face with tracking pulled in: a product
 * name is read as one shape rather than as a sequence of letters, which is the
 * whole difference between a wordmark and a heading that happens to be a name.
 */
export function Brand({
  className,
  href,
  mark,
  name,
  nameAccent,
  size = 'md',
  tagline,
  ...props
}: BrandProps) {
  const content = (
    <>
      {mark ? <span className="nim-brand__mark">{mark}</span> : null}
      <span className="nim-brand__text">
        <strong className="nim-brand__name">
          {name}
          {nameAccent ? <span className="nim-brand__name-accent">{nameAccent}</span> : null}
        </strong>
        {tagline ? <small className="nim-brand__tagline">{tagline}</small> : null}
      </span>
    </>
  )

  const classes = cn('nim-brand', className)

  if (href) {
    return (
      <a className={classes} data-size={size} href={href} {...(props as HTMLAttributes<HTMLAnchorElement>)}>
        {content}
      </a>
    )
  }

  return (
    <span className={classes} data-size={size} {...props}>
      {content}
    </span>
  )
}
