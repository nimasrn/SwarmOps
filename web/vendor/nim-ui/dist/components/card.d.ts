import { HTMLAttributes, ReactNode } from 'react';
export type CardPadding = 'lg' | 'md' | 'none' | 'sm';
export type CardVariant = 'accent' | 'default' | 'muted' | 'outline' | 'raised';
export interface CardProps extends HTMLAttributes<HTMLElement> {
    as?: 'article' | 'div' | 'section';
    children: ReactNode;
    footer?: ReactNode;
    header?: ReactNode;
    /** Visual affordance only. An interactive card must still be wrapped in, or
        rendered as, a real button or link — this never adds a handler. */
    interactive?: boolean;
    padding?: CardPadding;
    variant?: CardVariant;
}
export declare function Card({ as: Component, children, className, footer, header, interactive, padding, variant, ...props }: CardProps): import("react").JSX.Element;
