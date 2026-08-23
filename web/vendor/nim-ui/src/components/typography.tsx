import type { ElementType, HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface TextProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType
  children: ReactNode
}

/** The largest role: page-opening statements only, one per screen. */
export function Display({ as: Component = 'h1', children, className, ...props }: TextProps) {
  return (
    <Component className={cn('nim-display', className)} {...props}>
      {children}
    </Component>
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
  ...props
}: TextProps & { size?: 'md' | 'sm' }) {
  return (
    <Component className={cn('nim-body', size === 'sm' && 'nim-body--sm', className)} {...props}>
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

export function Caption({ as: Component = 'p', children, className, ...props }: TextProps) {
  return (
    <Component className={cn('nim-caption', className)} {...props}>
      {children}
    </Component>
  )
}

export function Rule({ className, ...props }: HTMLAttributes<HTMLHRElement>) {
  return <hr className={cn('nim-rule', className)} {...props} />
}
