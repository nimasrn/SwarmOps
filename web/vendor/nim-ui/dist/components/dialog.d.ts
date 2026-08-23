import { ReactNode } from 'react';
export interface DialogProps {
    children: ReactNode;
    className?: string;
    closeLabel?: string;
    description?: ReactNode;
    footer?: ReactNode;
    onClose: () => void;
    open: boolean;
    title: ReactNode;
}
/**
 * The centred modal, for a decision that has to be made now. The Sheet remains
 * nim's mobile-first surface; this is what a desktop confirmation wants.
 *
 * It renders a real `<dialog>` opened with `showModal()`, so the top layer,
 * the focus trap, the inert background and Escape all come from the platform
 * rather than from a scrim div and a keydown listener.
 */
export declare function Dialog({ children, className, closeLabel, description, footer, onClose, open, title, }: DialogProps): import("react").JSX.Element;
