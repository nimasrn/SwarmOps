import { HTMLAttributes } from 'react';
export interface SegmentedOption<T extends string> {
    disabled?: boolean;
    label: string;
    value: T;
}
export interface SegmentedProps<T extends string> extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
    fullWidth?: boolean;
    label: string;
    onChange: (value: T) => void;
    options: SegmentedOption<T>[];
    value: T;
}
/**
 * A tablist rather than a row of buttons: arrow-key navigation and the
 * selected state both come from the platform's tab semantics.
 */
export declare function Segmented<T extends string>({ className, fullWidth, label, onChange, options, value, ...props }: SegmentedProps<T>): import("react").JSX.Element;
