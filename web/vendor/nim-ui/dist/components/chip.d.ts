import { ReactNode } from 'react';
import { IconName } from './icon';
export type ChipTone = 'accent' | 'danger' | 'neutral' | 'success' | 'warning';
export interface ChipProps {
    children: ReactNode;
    className?: string;
    disabled?: boolean;
    icon?: IconName;
    /** Turns the chip into a toggle. Without it the chip is a static token. */
    onClick?: () => void;
    /** Adds the remove affordance. The chip's own click stays separate. */
    onRemove?: () => void;
    removeLabel?: string;
    selected?: boolean;
    tone?: ChipTone;
}
/**
 * A chip is an OBJECT — a filter in force, a recipient, a tag — where a badge
 * is a label ABOUT an object. That difference is why a chip can be pressed and
 * removed and a badge never is; a badge with an × in it is a chip wearing the
 * wrong name.
 *
 * The remove control is a sibling button, never a nested one: a button inside
 * a button is invalid markup and the inner one stops being reachable.
 */
export declare function Chip({ children, className, disabled, icon, onClick, onRemove, removeLabel, selected, tone, }: ChipProps): import("react").JSX.Element;
export interface ChipInputProps {
    className?: string;
    disabled?: boolean;
    error?: string;
    hint?: string;
    label?: string;
    /** Rejected entries are dropped silently; return `false` to refuse one. */
    onChange: (values: string[]) => void;
    placeholder?: string;
    removeLabel?: string;
    /** Keys that commit the draft. Comma is included because pasted lists use it. */
    separators?: string[];
    validate?: (value: string) => boolean;
    values: string[];
}
/**
 * The tokens live BEFORE the input, in the same box, so the caret sits after
 * the last chip the way it does in a mail client's To: field.
 *
 * Backspace on an empty draft removes the last chip — the behaviour every
 * token field has had since address bars, and the one users try first.
 */
export declare function ChipInput({ className, disabled, error, hint, label, onChange, placeholder, removeLabel, separators, validate, values, }: ChipInputProps): import("react").JSX.Element;
