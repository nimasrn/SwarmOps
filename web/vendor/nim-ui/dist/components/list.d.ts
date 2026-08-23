import { HTMLAttributes, ReactNode } from 'react';
export interface ListProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
    /** Drops the surrounding plate and keeps only the dividers. */
    plain?: boolean;
}
export declare function List({ children, className, plain, ...props }: ListProps): import("react").JSX.Element;
export interface ListRowProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
    /** Renders the row as a link. Mutually exclusive with `onClick`. */
    href?: string;
    leading?: ReactNode;
    subtitle?: ReactNode;
    title: ReactNode;
    trailing?: ReactNode;
}
export declare function ListRow({ className, href, leading, onClick, subtitle, title, trailing, ...props }: ListRowProps): import("react").JSX.Element;
