import { ReactNode } from 'react';
export type SortDirection = 'ascending' | 'descending';
export interface TableColumn<Row> {
    /** Aligns to the trailing edge in tabular figures. Use it for money, counts,
        and dates — anything a reader compares down a column. */
    numeric?: boolean;
    header: ReactNode;
    key: string;
    render: (row: Row) => ReactNode;
    sortable?: boolean;
    width?: string;
}
export interface TableProps<Row> {
    caption?: string;
    className?: string;
    columns: TableColumn<Row>[];
    onSort?: (key: string) => void;
    rowKey: (row: Row) => string;
    rows: Row[];
    sort?: {
        direction: SortDirection;
        key: string;
    };
}
/**
 * A table, not a grid of divs: the caller supplies columns and rows and gets
 * real `<table>` semantics, which is what lets a screen reader announce "row 3
 * of 84, Amount 4,200".
 *
 * Row height follows `--nim-density`, the same multiplier that drives control
 * heights — the reason density is a token rather than a prop here.
 */
export declare function Table<Row>({ caption, className, columns, onSort, rowKey, rows, sort }: TableProps<Row>): import("react").JSX.Element;
