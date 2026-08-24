import { ReactNode } from 'react';
import { SortDirection, TableColumn } from './table';
export interface DataTableSelection<Row> {
    /** Rows the caller considers selected. Held by the caller, because what a
        selection MEANS — survives a page change, survives a filter change,
        addresses ids the current page does not contain — is the product's
        decision and not a table's. */
    isSelected: (row: Row) => boolean;
    onToggle: (row: Row, selected: boolean) => void;
    onToggleAll?: (selected: boolean) => void;
    label?: (row: Row) => string;
}
export interface DataTableProps<Row> {
    caption?: string;
    className?: string;
    columns: TableColumn<Row>[];
    /** Rendered when `rows` is empty and nothing is loading or failing. */
    empty?: ReactNode;
    /** A failed load. It replaces the rows rather than sitting above stale
        ones: a table showing yesterday's rows under a red banner is read as
        today's rows by everyone in a hurry, which is everyone. */
    error?: ReactNode;
    labels?: {
        selectAll: string;
        selectRow: string;
    };
    /** First load only. A refetch keeps the current rows on screen and dims
        them — replacing a populated table with skeletons on every poll is how
        a live console becomes unreadable. */
    loading?: boolean;
    onRetry?: () => void;
    onSort?: (key: string) => void;
    /** 1-based. Omit the whole group to render no pagination. */
    page?: number;
    pageCount?: number;
    onPageChange?: (page: number) => void;
    /** Free text under the table — "Showing 1–25 of 3,120". */
    summary?: string;
    refreshing?: boolean;
    retryLabel?: string;
    rowKey: (row: Row) => string;
    rows: Row[];
    selection?: DataTableSelection<Row>;
    skeletonRows?: number;
    sort?: {
        direction: SortDirection;
        key: string;
    };
    /** The filter/action strip. Passed in rather than assembled here: which
        filters a collection has is the screen's knowledge, and a table that
        generates its own controls from its columns generates the wrong ones. */
    toolbar?: ReactNode;
}
/**
 * A collection screen in one component: toolbar, table, selection, the four
 * states a remote list is ever in, and pagination.
 *
 * `Table` stays the primitive underneath and is still the right choice for a
 * table that is just a table. This is the assembly both consumers had written
 * twice each — and had written differently each time, which is why one of them
 * lost its empty state and the other showed a spinner over stale rows.
 *
 * The four states are mutually exclusive and resolved in one place, in this
 * order: error, first load, empty, rows. That ordering is the component's
 * actual contract — every ad-hoc version of this got it wrong by rendering an
 * empty state during the first load.
 */
export declare function DataTable<Row>({ caption, className, columns, empty, error, labels, loading, onPageChange, onRetry, onSort, page, pageCount, refreshing, retryLabel, rowKey, rows, selection, skeletonRows, sort, summary, toolbar, }: DataTableProps<Row>): import("react").JSX.Element;
