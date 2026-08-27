import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export type AvatarSize = 'lg' | 'md' | 'sm'

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  /** Falls back to initials derived from `name` when no image is supplied. */
  name: string
  shape?: 'round' | 'square'
  size?: AvatarSize
  src?: string
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

export function Avatar({ className, name, shape = 'round', size = 'md', src, ...props }: AvatarProps) {
  return (
    <span
      className={cn('nim-avatar', size !== 'md' && `nim-avatar--${size}`, shape === 'square' && 'nim-avatar--square', className)}
      {...props}
    >
      {src ? <img alt="" src={src} /> : <span aria-hidden="true">{initials(name)}</span>}
      <span className="nim-visually-hidden">{name}</span>
    </span>
  )
}
