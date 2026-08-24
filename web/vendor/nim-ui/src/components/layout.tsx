import type { ElementType, HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface BoxProps extends HTMLAttributes<HTMLDivElement> {
  /** `Stack` and `Inline` are rhythm, not semantics. A form laid out on the
      stack rhythm is still a `<form>`, and wrapping one in a spacing div only
      adds a node that means nothing to anything reading the page. */
  as?: ElementType
  children: ReactNode
}

/** The mobile app viewport, centred on a desktop screen. */
export function AppFrame({ children, className, ...props }: BoxProps) {
  return (
    <div className={cn('nim-app-frame', className)} {...props}>
      {children}
    </div>
  )
}

/** Vertical rhythm. Spacing between components belongs to the page, not to
    the components, and this is where the page expresses it. */
export function Stack({
  as: Component = 'div',
  children,
  className,
  gap = 'md',
  ...props
}: BoxProps & { gap?: 'loose' | 'md' | 'tight' }) {
  return (
    <Component className={cn('nim-stack', gap !== 'md' && `nim-stack--${gap}`, className)} {...props}>
      {children}
    </Component>
  )
}

/** Horizontal rhythm, and the same `gap` vocabulary `Stack` speaks — a page
    that has to say `tight` one way and write a style attribute the other has
    two spacing systems, not one. Wrapping is the default: a row of controls
    that cannot wrap is a row that overflows on a phone. */
export function Inline({
  as: Component = 'div',
  children,
  className,
  gap = 'md',
  wrap = true,
  ...props
}: BoxProps & { gap?: 'loose' | 'md' | 'tight'; wrap?: boolean }) {
  return (
    <Component
      className={cn('nim-inline', gap !== 'md' && `nim-inline--${gap}`, !wrap && 'nim-inline--nowrap', className)}
      {...props}
    >
      {children}
    </Component>
  )
}
