import { ReactNode } from 'react';
/**
 * nim has two independent appearance axes.
 *
 * A STYLE owns how the interface is shaped: radii, elevation geometry, type
 * voice, press behaviour. A COLOURWAY owns how it is coloured: surfaces, ink,
 * lines, accent, status. They compose freely — `ledger` + `teal` is a legal
 * pairing, not a mistake — which is why they are two attributes rather than
 * one `theme` name multiplying out into a file per combination.
 */
export type NimStyle = 'ledger' | 'vlora';
export type NimColorway = 'coral' | 'oxblood' | 'teal' | 'vermilion';
/** `system` follows the OS and is resolved by CSS, not by JavaScript. */
export type NimScheme = 'dark' | 'light' | 'system';
export type NimDirection = 'ltr' | 'rtl';
interface NimContextValue {
    colorway: NimColorway;
    direction: NimDirection;
    /** BCP 47 tag. Components that format dates or numbers use it; the script
        corrections in `persian.css` key off the `lang` attribute it writes. */
    locale: string | undefined;
    scheme: NimScheme;
    setColorway: (colorway: NimColorway) => void;
    setScheme: (scheme: NimScheme) => void;
    setStyle: (style: NimStyle) => void;
    style: NimStyle;
}
export interface NimProviderProps {
    children: ReactNode;
    className?: string;
    defaultColorway?: NimColorway;
    defaultScheme?: NimScheme;
    defaultStyle?: NimStyle;
    direction?: NimDirection;
    /** BCP 47 tag, e.g. `fa-IR`. Written to `lang`, which is what turns on the
        Persian script corrections and gives Calendar its month and weekday
        names and its digits. Direction is separate: `dir` says which way the
        line runs, `lang` says which script is being set. */
    locale?: string;
    /** Writes the appearance attributes onto <html> as well, so portalled
        surfaces (sheets, dialogs, menus, toasts) inherit them from outside the
        React tree. */
    syncDocument?: boolean;
}
export declare function NimProvider({ children, className, defaultColorway, defaultScheme, defaultStyle, direction, locale, syncDocument, }: NimProviderProps): import("react").JSX.Element;
export declare function useNim(): NimContextValue;
/** Convenience for a header toggle: flips light ⇄ dark, leaving `system`. */
export declare function useSchemeToggle(): () => void;
export {};
