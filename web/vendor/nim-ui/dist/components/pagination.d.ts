export interface PaginationProps {
    className?: string;
    label?: string;
    nextLabel?: string;
    onChange: (page: number) => void;
    page: number;
    pageCount: number;
    previousLabel?: string;
    /** Free text on the leading edge — "Showing 1–6 of 84". */
    summary?: string;
}
export declare function Pagination({ className, label, nextLabel, onChange, page, pageCount, previousLabel, summary, }: PaginationProps): import("react").JSX.Element;
