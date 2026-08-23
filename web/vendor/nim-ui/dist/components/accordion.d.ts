import { ReactNode } from 'react';
export interface AccordionItem {
    /** Rendered when the panel is open. Mounted whether or not it is open, so
        in-panel form state survives a collapse. */
    content: ReactNode;
    disabled?: boolean;
    id: string;
    /** A short right-aligned note on the header row — a count, a status. */
    meta?: ReactNode;
    title: string;
}
export interface AccordionProps {
    className?: string;
    /** Uncontrolled starting state. Ignored when `open` is given. */
    defaultOpen?: string[];
    items: AccordionItem[];
    /** One panel at a time. The default lets several stand open, because a
        reader comparing two sections should not have to choose between them. */
    mode?: 'multiple' | 'single';
    onOpenChange?: (open: string[]) => void;
    open?: string[];
    /** Flush rows on the page's own surface, rather than a bordered block. */
    variant?: 'plain' | 'panel';
}
/**
 * Disclosure built on `<button aria-expanded>` + a height transition, not on
 * `<details>`: `<details>` cannot animate its own open state across browsers,
 * and it cannot be driven from outside without fighting the element.
 *
 * The panel animates `grid-template-rows: 0fr → 1fr`, which is what lets it
 * open to its CONTENT's height without measuring anything in JavaScript.
 */
export declare function Accordion({ className, defaultOpen, items, mode, onOpenChange, open, variant, }: AccordionProps): import("react").JSX.Element;
