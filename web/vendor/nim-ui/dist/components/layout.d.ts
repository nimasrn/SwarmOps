import { ElementType, HTMLAttributes, ReactNode } from 'react';
interface BoxProps extends HTMLAttributes<HTMLDivElement> {
    /** `Stack` and `Inline` are rhythm, not semantics. A form laid out on the
        stack rhythm is still a `<form>`, and wrapping one in a spacing div only
        adds a node that means nothing to anything reading the page. */
    as?: ElementType;
    children: ReactNode;
}
/** The mobile app viewport, centred on a desktop screen. */
export declare function AppFrame({ children, className, ...props }: BoxProps): import("react").JSX.Element;
/** Vertical rhythm. Spacing between components belongs to the page, not to
    the components, and this is where the page expresses it. */
export declare function Stack({ as: Component, children, className, gap, ...props }: BoxProps & {
    gap?: 'loose' | 'md' | 'tight';
}): import("react").JSX.Element;
/** Horizontal rhythm, and the same `gap` vocabulary `Stack` speaks — a page
    that has to say `tight` one way and write a style attribute the other has
    two spacing systems, not one. Wrapping is the default: a row of controls
    that cannot wrap is a row that overflows on a phone. */
export declare function Inline({ as: Component, children, className, gap, wrap, ...props }: BoxProps & {
    gap?: 'loose' | 'md' | 'tight';
    wrap?: boolean;
}): import("react").JSX.Element;
export {};
