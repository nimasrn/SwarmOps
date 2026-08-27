export interface OtpInputProps {
    /** Fires as soon as the last box is filled — by typing, pasting, or SMS
        autofill. The caller does not need to watch `value.length` itself. */
    autoFocus?: boolean;
    className?: string;
    error?: string;
    label: string;
    length?: number;
    onChange: (value: string) => void;
    onComplete?: (value: string) => void;
    /** Per-box accessible name, e.g. `(i) => `Digit ${i + 1}``. */
    digitLabel?: (index: number) => string;
    /** The code so far, ASCII digits only, shorter than `length` while typing. */
    value: string;
}
/**
 * The boxed one-time code.
 *
 * One `<input>` per digit, but the string is the caller's: the component never
 * holds a per-box array, so a paste, an SMS autofill, and a keystroke all take
 * the same path and cannot disagree. The row is pinned `dir="ltr"` even inside
 * a Persian page — a code is a number, and the first digit belongs on the left
 * in every script. Input is normalised through `toAsciiDigits`, so ۱۲۳۴۵ typed
 * on a Persian keyboard arrives as `12345`.
 *
 * `autocomplete="one-time-code"` on the first box is what lets iOS and Android
 * offer the code from the SMS itself.
 */
export declare function OtpInput({ autoFocus, className, digitLabel, error, label, length, onChange, onComplete, value, }: OtpInputProps): import("react").JSX.Element;
