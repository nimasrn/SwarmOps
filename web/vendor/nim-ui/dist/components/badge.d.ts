import { HTMLAttributes, ReactNode } from 'react';
export type BadgeSize = 'md' | 'sm';
export type BadgeTone = 'outline' | 'soft' | 'solid';
export type BadgeVariant = 'accent' | 'danger' | 'info' | 'neutral' | 'success' | 'warning';
export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    children: ReactNode;
    /** Shows a status dot before the label — for live/among-states meanings. */
    dot?: boolean;
    pill?: boolean;
    size?: BadgeSize;
    tone?: BadgeTone;
    variant?: BadgeVariant;
}
export declare function Badge({ children, className, dot, pill, size, tone, variant, ...props }: BadgeProps): import("react").JSX.Element;
