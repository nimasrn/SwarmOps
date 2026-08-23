import { ButtonHTMLAttributes, ReactNode } from 'react';
import { IconName } from './icon';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonVariant = 'accent' | 'danger' | 'ghost' | 'primary' | 'secondary';
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    children: ReactNode;
    fullWidth?: boolean;
    /** Icon on the trailing edge — travels with the reading direction. */
    iconEnd?: IconName;
    iconStart?: IconName;
    /** Blocks interaction and announces busy; the label stays in place so the
        button does not change width mid-request. */
    loading?: boolean;
    size?: ButtonSize;
    variant?: ButtonVariant;
}
/**
 * The ref is forwarded because overlays anchor to their trigger: Menu and
 * Popover need the element, not a wrapper around it.
 */
export declare const Button: import('react').ForwardRefExoticComponent<ButtonProps & import('react').RefAttributes<HTMLButtonElement>>;
