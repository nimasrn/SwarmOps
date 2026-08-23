import { HTMLAttributes } from 'react';
export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
    label?: string;
    size?: 'lg' | 'md' | 'sm';
}
export declare function Spinner({ className, label, size, ...props }: SpinnerProps): import("react").JSX.Element;
export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
    label?: string;
    /** Omit for an indeterminate bar. */
    value?: number;
}
export declare function Progress({ className, label, value, ...props }: ProgressProps): import("react").JSX.Element;
export interface SkeletonProps extends HTMLAttributes<HTMLSpanElement> {
    height?: number | string;
    radius?: string;
    width?: number | string;
}
export declare function Skeleton({ className, height, radius, width, ...props }: SkeletonProps): import("react").JSX.Element;
