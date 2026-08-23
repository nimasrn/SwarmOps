import { ReactNode } from 'react';
import { TabBarProps } from './tab-bar';
export interface AppShellProps {
    children: ReactNode;
    className?: string;
    /** Sticky top row: a title, a back control, an action. Optional — many
        screens carry their own header inside the content instead. */
    header?: ReactNode;
    /** The bottom navigation. Omit it on a screen deeper in the stack: a tab bar
        that stays visible under a detail page invites the viewer to leave. */
    tabs?: TabBarProps;
}
/**
 * The frame an app lives in: a sticky header, one scrolling region, and the
 * tab bar.
 *
 * The scroll container is here and nowhere else, which is what makes scroll
 * restoration, pull-to-refresh and "scroll to top on tab change" one thing to
 * implement rather than one per screen. The content region reserves room for
 * the bar it is drawn under, so the last row of a list is never hidden behind
 * it — the failure this component exists to prevent.
 */
export declare function AppShell({ children, className, header, tabs }: AppShellProps): import("react").JSX.Element;
