import { HTMLAttributes } from 'react';
export interface TabOption<T extends string> {
    /** A trailing figure — a count, never a decoration. */
    count?: number | string;
    disabled?: boolean;
    label: string;
    value: T;
}
export interface TabsProps<T extends string> extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
    label: string;
    onChange: (value: T) => void;
    options: TabOption<T>[];
    value: T;
}
/**
 * Tabs switch a region of the page. A Segmented control sets a value. They
 * look similar and mean different things, and 0.1 had the segmented control
 * carrying both jobs.
 *
 * Arrow keys move between tabs and select as they go — the pattern a tablist
 * is expected to follow when its panels are cheap to render.
 */
export declare function Tabs<T extends string>({ className, label, onChange, options, value, ...props }: TabsProps<T>): import("react").JSX.Element;
