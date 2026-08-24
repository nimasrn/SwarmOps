import { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { IconName } from './icon';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonVariant = 'accent' | 'danger' | 'ghost' | 'primary' | 'secondary';
interface ButtonOwnProps {
    children: ReactNode;
    fullWidth?: boolean;
    /** Icon on the trailing edge — travels with the reading direction. */
    iconEnd?: IconName;
    iconStart?: IconName;
    /** Blocks interaction and announces busy; the label stays in place so the
        button does not change width mid-request. */
    loading?: boolean;
    size?: ButtonSize;
    variant?: ButtonVariant;
}
/**
 * `href` renders a real `<a>`.
 *
 * A control that navigates IS a link, and a `<button onClick={navigate}>`
 * cannot be opened in a new tab, cannot be copied, and does not announce
 * itself as a link. Consumers without this prop reach for an `asChild`
 * escape hatch and hand-write the classes, which is how the focus ring and
 * the press behaviour drift per call site.
 *
 * `loading` and `disabled` are button-only: there is no such thing as a
 * disabled link in HTML, and faking one with `aria-disabled` leaves it in the
 * tab order still navigating. Don't render a link for an action that can be
 * in flight — render a button.
 */
export type ButtonProps = (ButtonOwnProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
    href?: never;
}) | (ButtonOwnProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'> & {
    disabled?: never;
    href: string;
    loading?: never;
});
/**
 * The ref is forwarded because overlays anchor to their trigger: Menu and
 * Popover need the element, not a wrapper around it.
 */
export declare const Button: import('react').ForwardRefExoticComponent<ButtonProps & import('react').RefAttributes<HTMLButtonElement>>;
export {};
