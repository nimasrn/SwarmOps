export interface RatingProps {
    className?: string;
    /** Read-only ratings are a figure, not a control: no focus, no hover. */
    readOnly?: boolean;
    count?: number;
    label: string;
    onChange?: (value: number) => void;
    size?: 'lg' | 'md' | 'sm';
    /** Fractional values render a partly filled star; input still snaps to
        whole stars, because half a click is not an opinion anyone holds. */
    value: number;
}
/**
 * A radio group behind stars. The stars are decoration painted over real
 * inputs, so arrow keys, form submission and "3 of 5 selected" all come from
 * the platform — a row of `<button>`s gives none of that and is what makes
 * most star ratings unusable by keyboard.
 */
export declare function Rating({ className, count, label, onChange, readOnly, size, value, }: RatingProps): import("react").JSX.Element;
