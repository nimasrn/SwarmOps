export interface Crumb {
    href?: string;
    label: string;
}
export interface BreadcrumbProps {
    className?: string;
    /** The trail, root first. The last entry is the current page and is never a
        link — a link to where the reader already is has nothing to offer. */
    items: Crumb[];
    label?: string;
}
export declare function Breadcrumb({ className, items, label }: BreadcrumbProps): import("react").JSX.Element;
