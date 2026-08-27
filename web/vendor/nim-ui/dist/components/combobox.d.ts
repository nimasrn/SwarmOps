export interface ComboboxOption<T extends string> {
    disabled?: boolean;
    label: string;
    /** A trailing hint set in the mono — a count, a code, a date. */
    meta?: string;
    value: T;
}
export interface ComboboxProps<T extends string> {
    className?: string;
    /** Shown when nothing matches. Give the viewer the way forward rather than
        a dead end: "No client matches — create it". */
    emptyState?: (query: string) => React.ReactNode;
    error?: string;
    hint?: string;
    id?: string;
    label?: string;
    onChange: (value: T | null) => void;
    options: ComboboxOption<T>[];
    placeholder?: string;
    required?: boolean;
    value: T | null;
}
/**
 * A text input that suggests, and can still be typed into.
 *
 * A real `<input>` with `role="combobox"` over a `role="listbox"`, so the
 * platform's text editing, autofill and form participation are untouched.
 * Arrow keys move the active option, Enter commits it, Escape reverts to the
 * last committed value rather than clearing the field.
 */
export declare function Combobox<T extends string>({ className, emptyState, error, hint, id, label, onChange, options, placeholder, required, value, }: ComboboxProps<T>): import("react").JSX.Element;
