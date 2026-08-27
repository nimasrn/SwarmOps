import { HTMLAttributes, ReactNode } from 'react';
export interface StatProps extends HTMLAttributes<HTMLDivElement> {
    /** Signed change, e.g. `+12%`. Direction colours it and picks the arrow. */
    delta?: string;
    deltaDirection?: 'down' | 'up';
    label: ReactNode;
    unit?: ReactNode;
    value: ReactNode;
}
export declare function Stat({ className, delta, deltaDirection, label, unit, value, ...props }: StatProps): import("react").JSX.Element;
