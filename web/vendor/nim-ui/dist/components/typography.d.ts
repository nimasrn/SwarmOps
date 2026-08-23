import { ElementType, HTMLAttributes, ReactNode } from 'react';
interface TextProps extends HTMLAttributes<HTMLElement> {
    as?: ElementType;
    children: ReactNode;
}
/** The largest role: page-opening statements only, one per screen. */
export declare function Display({ as: Component, children, className, ...props }: TextProps): import("react").JSX.Element;
export declare function Title({ as: Component, children, className, size, ...props }: TextProps & {
    size?: 'lg' | 'md';
}): import("react").JSX.Element;
export declare function Body({ as: Component, children, className, size, ...props }: TextProps & {
    size?: 'md' | 'sm';
}): import("react").JSX.Element;
/** Mono/uppercase in Ledger, sentence case in Vlora — the theme decides. */
export declare function Label({ as: Component, children, className, ...props }: TextProps): import("react").JSX.Element;
export declare function Caption({ as: Component, children, className, ...props }: TextProps): import("react").JSX.Element;
export declare function Rule({ className, ...props }: HTMLAttributes<HTMLHRElement>): import("react").JSX.Element;
export {};
