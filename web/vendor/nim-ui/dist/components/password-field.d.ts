import { InputHTMLAttributes } from 'react';
export type PasswordStrength = 'fair' | 'good' | 'strong' | 'weak';
export interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
    error?: string;
    hint?: string;
    label?: string;
    /** Draws the meter. Omit on a sign-in field: scoring a password someone
        already has tells them nothing they can act on. */
    strength?: PasswordStrength;
    /** Accessible names for the reveal toggle and the meter. */
    labels?: {
        hide: string;
        show: string;
        strength: (level: PasswordStrength) => string;
    };
}
/**
 * A password input with a reveal toggle and an optional strength meter.
 *
 * Revealing is a real `type` swap rather than a font trick, so a password
 * manager still sees a password field, and the toggle is a button with a
 * label — an icon that changes silently leaves a screen reader unable to tell
 * whether the characters are showing.
 *
 * Scoring is the caller's: strength depends on the policy being enforced, and
 * a meter that disagrees with the server's rules is worse than none.
 */
export declare function PasswordField({ className, error, hint, id, label, labels, required, strength, ...props }: PasswordFieldProps): import("react").JSX.Element;
/**
 * A default score for products without a policy of their own: length first,
 * then variety. Deliberately blunt — it is a hint, never a gate.
 */
export declare function scorePassword(password: string): PasswordStrength;
