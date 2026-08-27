import { ButtonHTMLAttributes } from 'react';
import { IconName } from './icon';
export type IconButtonSize = 'sm' | 'md' | 'lg';
export type IconButtonVariant = 'ghost' | 'outline' | 'solid';
export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
    /** Required: an icon-only control has no other accessible name. */
    label: string;
    name: IconName;
    size?: IconButtonSize;
    variant?: IconButtonVariant;
}
export declare const IconButton: import('react').ForwardRefExoticComponent<IconButtonProps & import('react').RefAttributes<HTMLButtonElement>>;
