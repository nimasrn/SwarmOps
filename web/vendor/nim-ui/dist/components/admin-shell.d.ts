import { ReactNode } from 'react';
import { IconName } from './icon';
export interface AdminNavItem {
    href?: string;
    icon?: IconName;
    key: string;
    label: ReactNode;
    onSelect?: () => void;
}
export interface AdminNavGroup {
    icon?: IconName;
    items: AdminNavItem[];
    key: string;
    label: ReactNode;
}
export interface AdminShellProps {
    /** Brand mark at the top of the sidebar. */
    brand?: ReactNode;
    children: ReactNode;
    className?: string;
    /** Under the nav: session state, build version — the things an operator
        checks before believing a screen. */
    sidebarFooter?: ReactNode;
    groups: AdminNavGroup[];
    labels?: {
        menu: string;
        nav: string;
        close: string;
    };
    /** `key` of the active item. */
    value: string;
    /** Search field, status pills, the signed-in operator. */
    toolbar?: ReactNode;
    title?: ReactNode;
}
/**
 * The console layout: a grouped sidebar, a topbar, and one scrolling workspace.
 *
 * The counterpart to `AppShell`, and deliberately a different component rather
 * than a `variant`: an operator console is a desktop-first, two-column, deep
 * hierarchy, and a phone app is a single column with five destinations. Sharing
 * one component would mean every screen carrying the other's assumptions.
 *
 * Below the layout's breakpoint the same sidebar becomes a drawer — the same
 * markup, not a second nav to keep in sync, which is how the two drift apart.
 */
export declare function AdminShell({ brand, children, className, groups, labels, sidebarFooter, title, toolbar, value, }: AdminShellProps): import("react").JSX.Element;
export interface DetailHeaderProps {
    /** Buttons for this record: approve, retry, export. */
    actions?: ReactNode;
    back?: {
        href?: string;
        label: string;
        onClick?: () => void;
    };
    className?: string;
    /** Status badge, owner, id — the facts that qualify the title. */
    meta?: ReactNode;
    status?: ReactNode;
    subtitle?: ReactNode;
    title: ReactNode;
}
/**
 * The top of a record: where it sits, what it is, and what can be done to it.
 *
 * The actions live here rather than at the bottom of the page because an
 * operator working a queue acts on the record without reading all of it, and a
 * button below a thousand-row table is a button nobody finds.
 */
export declare function DetailHeader({ actions, back, className, meta, status, subtitle, title, }: DetailHeaderProps): import("react").JSX.Element;
export interface FilterChip {
    key: string;
    label: ReactNode;
    onRemove: () => void;
    /** The value the filter is set to, shown after the label. */
    value?: ReactNode;
}
export interface FilterChipsProps {
    chips: FilterChip[];
    className?: string;
    clearLabel?: string;
    labels?: {
        remove: (label: string) => string;
        toolbar: string;
    };
    onClearAll?: () => void;
}
/**
 * The filters currently narrowing a table, each removable.
 *
 * It renders nothing when there are none — an empty toolbar reserving space
 * for filters nobody set is the reason these strips feel like chrome. Every
 * chip states what it removes in its accessible name, because "remove" ten
 * times over is no name at all.
 */
export declare function FilterChips({ chips, className, clearLabel, labels, onClearAll, }: FilterChipsProps): import("react").JSX.Element | null;
export interface ActivityEvent {
    /** What happened, in the product's own words. */
    action: ReactNode;
    actor?: ReactNode;
    /** ISO timestamp. Formatted here, in the viewer's locale. */
    at?: string;
    icon?: IconName;
    id: string;
    target?: ReactNode;
    tone?: 'accent' | 'danger' | 'default' | 'success' | 'warning';
}
export interface ActivityFeedProps {
    className?: string;
    empty?: ReactNode;
    events: ActivityEvent[];
    locale?: string;
}
/**
 * Who did what, most recent first.
 *
 * Timestamps are absolute rather than "3 hours ago": an audit trail is read to
 * reconstruct a sequence, and a relative time that keeps moving is exactly
 * what you cannot compare two of.
 */
export declare function ActivityFeed({ className, empty, events, locale }: ActivityFeedProps): import("react").JSX.Element;
