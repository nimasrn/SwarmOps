import { ReactNode } from 'react';
export interface SheetProps {
    children: ReactNode;
    className?: string;
    /** Label for the close control; also names the dialog when no title is set. */
    closeLabel?: string;
    footer?: ReactNode;
    onClose: () => void;
    open: boolean;
    title?: ReactNode;
}
/**
 * The bottom sheet is nim's modal surface. It owns the three things that are
 * always forgotten in hand-rolled sheets: the page behind it must not scroll,
 * Escape must close it, and focus must move into it on open and be restorable
 * on close.
 */
export declare function Sheet({ children, className, closeLabel, footer, onClose, open, title }: SheetProps): import('react').ReactPortal | null;
