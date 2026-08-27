import { ElementType, HTMLAttributes, ReactNode } from 'react';
interface TextProps extends HTMLAttributes<HTMLElement> {
    as?: ElementType;
    children: ReactNode;
}
/** Ink roles a text run may take. It is the status vocabulary the rest of the
    console already speaks, so a green word in a table and a green dot in the
    row beside it cannot come from two different greens. `tone` colours only —
    a tone is never the sole carrier of meaning, so the word still has to say
    what the colour is claiming. */
export type TextTone = 'accent' | 'danger' | 'default' | 'muted' | 'success' | 'warning';
/**
 * The largest role: page-opening statements only, one per screen.
 *
 * `size` reaches the editorial register — `lg` for a section that opens a long
 * document, `xl` for a page's single claim. Both drop `text-wrap: balance`,
 * because at those sizes where a line breaks is a copy decision: author the
 * break with `Display.Line` rather than letting the browser move words between
 * lines on every resize.
 */
export declare function Display({ as: Component, children, className, size, ...props }: TextProps & {
    size?: 'md' | 'lg' | 'xl';
}): import("react").JSX.Element;
export declare namespace Display {
    var Line: ({ children, accent, indent, className, ...props }: HTMLAttributes<HTMLSpanElement> & {
        children: ReactNode;
        accent?: boolean;
        indent?: boolean;
    }) => import("react").JSX.Element;
}
export declare function Title({ as: Component, children, className, size, ...props }: TextProps & {
    size?: 'lg' | 'md';
}): import("react").JSX.Element;
export declare function Body({ as: Component, children, className, size, tone, ...props }: TextProps & {
    size?: 'md' | 'sm';
    tone?: TextTone;
}): import("react").JSX.Element;
/** Mono/uppercase in Ledger, sentence case in Vlora — the theme decides. */
export declare function Label({ as: Component, children, className, ...props }: TextProps): import("react").JSX.Element;
export declare function Caption({ as: Component, children, className, tone, ...props }: TextProps & {
    tone?: TextTone;
}): import("react").JSX.Element;
export declare function Rule({ className, ...props }: HTMLAttributes<HTMLHRElement>): import("react").JSX.Element;
export {};
