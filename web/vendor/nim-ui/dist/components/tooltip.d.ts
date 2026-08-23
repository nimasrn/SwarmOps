import { ReactNode } from 'react';
export interface TooltipProps {
    children: ReactNode;
    className?: string;
    /** The text shown on hover. Never the only place the name lives. */
    label: string;
}
/**
 * A name for a control that shows only an icon.
 *
 * The bubble is `aria-hidden`: the trigger inside must already carry its own
 * accessible name (IconButton does), so a screen reader is never read the same
 * label twice, and a viewer who cannot hover never depends on this.
 *
 * Hover waits 200ms; keyboard focus does not, because a viewer who tabbed here
 * has already asked.
 */
export declare function Tooltip({ children, className, label }: TooltipProps): import("react").JSX.Element;
