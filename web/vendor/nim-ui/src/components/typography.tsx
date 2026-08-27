import type { ElementType, HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface TextProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType
  children: ReactNode
}

/** Ink roles a text run may take. It is the status vocabulary the rest of the
    console already speaks, so a green word in a table and a green dot in the
    row beside it cannot come from two different greens. `tone` colours only —
    a tone is never the sole carrier of meaning, so the word still has to say
    what the colour is claiming. */
export type TextTone = 'accent' | 'danger' | 'default' | 'muted' | 'success' | 'warning'

const toneClass = (tone: TextTone = 'default') =>
  tone === 'default' ? undefined : `nim-text--${tone}`

/**
 * The largest role: page-opening statements only, one per screen.
 *
 * `size` reaches the editorial register — `lg` for a section that opens a long
 * document, `xl` for a page's single claim. Both drop `text-wrap: balance`,
 * because at those sizes where a line breaks is a copy decision: author the
 * break with `Display.Line` rather than letting the browser move words between
 * lines on every resize.
 */
export function Display({
  as: Component = 'h1',
  children,
  className,
  size = 'md',
  ...props
}: TextProps & { size?: 'md' | 'lg' | 'xl' }) {
  return (
    <Component
      className={cn(
        'nim-display',
        size === 'lg' && 'nim-display--lg',
        size === 'xl' && 'nim-display--xl',
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  )
}

/**
 * One authored line of a claim. `accent` inks it in the colourway's accent —
 * the single ornament this system allows a headline — and `indent` steps it
 * off the reading margin, which mirrors on its own in RTL.
 */
Display.Line = function DisplayLine({
  children,
  accent,
  indent,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { children: ReactNode; accent?: boolean; indent?: boolean }) {
  return (
    <span
      className={cn('nim-display__line', accent && 'nim-display__accent', className)}
      data-indent={indent ? 'true' : undefined}
      {...props}
    >
      {children}
    </span>
  )
}

export function Title({
  as: Component = 'h2',
  children,
  className,
  size = 'lg',
  ...props
}: TextProps & { size?: 'lg' | 'md' }) {
  return (
    <Component className={cn('nim-title', size === 'md' && 'nim-title--md', className)} {...props}>
      {children}
    </Component>
  )
}

export function Body({
  as: Component = 'p',
  children,
  className,
  size = 'md',
  tone,
  ...props
}: TextProps & { size?: 'md' | 'sm'; tone?: TextTone }) {
  return (
    <Component className={cn('nim-body', size === 'sm' && 'nim-body--sm', toneClass(tone), className)} {...props}>
      {children}
    </Component>
  )
}

/** Mono/uppercase in Ledger, sentence case in Vlora — the theme decides. */
export function Label({ as: Component = 'span', children, className, ...props }: TextProps) {
  return (
    <Component className={cn('nim-label', className)} {...props}>
      {children}
    </Component>
  )
}

export function Caption({ as: Component = 'p', children, className, tone, ...props }: TextProps & { tone?: TextTone }) {
  return (
    <Component className={cn('nim-caption', toneClass(tone), className)} {...props}>
      {children}
    </Component>
  )
}

export function Rule({ className, ...props }: HTMLAttributes<HTMLHRElement>) {
  return <hr className={cn('nim-rule', className)} {...props} />
}
