import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { Icon, type IconName, type IconSize } from '@/components/icon'
import { cn } from '@/lib/cn'

export type IconButtonSize = 'sm' | 'md' | 'lg'
export type IconButtonVariant = 'ghost' | 'outline' | 'solid'

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Required: an icon-only control has no other accessible name. */
  label: string
  name: IconName
  size?: IconButtonSize
  variant?: IconButtonVariant
}

const GLYPH_SIZE: Record<IconButtonSize, IconSize> = { sm: 'sm', md: 'md', lg: 'md' }

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, label, name, size = 'md', type = 'button', variant = 'ghost', ...props },
  ref,
) {
  return (
    <button
      aria-label={label}
      className={cn('nim-icon-button', `nim-icon-button--${variant}`, `nim-icon-button--${size}`, className)}
      ref={ref}
      title={label}
      type={type}
      {...props}
    >
      <Icon name={name} size={GLYPH_SIZE[size]} />
    </button>
  )
})
