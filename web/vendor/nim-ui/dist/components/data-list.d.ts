import { ReactNode } from 'react';
export interface DataListRow {
    id: string;
    label: ReactNode;
    /** Values that should not wrap mid-token — an ID, a hash — set this. */
    mono?: boolean;
    value?: ReactNode;
}
export interface DataListProps {
    className?: string;
    /** `rows` reads as a two-column ledger; `stack` puts the label above the
        value, which is what narrow columns and phone widths need. */
    layout?: 'rows' | 'stack';
    rows: DataListRow[];
}
/**
 * `<dl>` — the one element the platform has for "these labels describe these
 * values". A table would claim a grid that does not exist here, and a list of
 * `<div>`s would lose the pairing entirely.
 *
 * A row where the value is missing still renders: an empty field is
 * information, and hiding it makes two records with different data look alike.
 */
export declare function DataList({ className, layout, rows }: DataListProps): import("react").JSX.Element;
