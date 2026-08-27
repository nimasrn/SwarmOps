import { ReactNode } from 'react';
import { IconName } from './icon';
export interface OptionCardProps {
    /** A short word on the trailing edge: "manual review", "default". */
    badge?: ReactNode;
    className?: string;
    description?: ReactNode;
    disabled?: boolean;
    icon?: IconName;
    /** Rendered under the description when chosen — an account number, a
        delivery window. Hidden otherwise, because it is only true of the
        selected option. */
    detail?: ReactNode;
    name?: string;
    onSelect: () => void;
    selected: boolean;
    title: ReactNode;
}
/**
 * One choice in a list of choices: a payment method, a saved address, a
 * delivery window.
 *
 * A real `<input type="radio">` inside the card, visually hidden, is what makes
 * a set of these behave like a radio group — arrow keys move between them, the
 * name groups them, and a form submits the chosen one. The card is the label,
 * so the whole plate is the target rather than a 20px dot beside it.
 */
export declare function OptionCard({ badge, className, description, detail, disabled, icon, name, onSelect, selected, title, }: OptionCardProps): import("react").JSX.Element;
export interface SummaryLine {
    /** Set on the line the eye should land on — the total. At most one. */
    emphasis?: boolean;
    key: string;
    label: ReactNode;
    /** A qualifier under the label: "6 months · renews 1405/12/01". */
    meta?: ReactNode;
    /** Already formatted. Currency and digits are the product's locale call. */
    value: ReactNode;
}
export interface OrderSummaryProps {
    className?: string;
    /** Deductions. Rendered in the success tone with the sign the caller gives
        them — the kit does not do arithmetic on money it cannot see. */
    items: SummaryLine[];
    /** Subtotal, tax, fees, total: the arithmetic, under a rule. */
    totals?: SummaryLine[];
    title?: ReactNode;
}
/**
 * What is being bought, and what it comes to.
 *
 * Every figure is a `ReactNode` the caller has already formatted. That is
 * deliberate: money is the last thing a UI kit should be computing or
 * rounding, and a component that took numbers would have to guess a currency,
 * a tax rule and a digit shape — three decisions that belong to the product
 * and are wrong in Persian first.
 */
export declare function OrderSummary({ className, items, title, totals }: OrderSummaryProps): import("react").JSX.Element;
export interface ActionBarProps {
    /** The primary control. One only: a bar with two equal buttons has none. */
    action: ReactNode;
    className?: string;
    /** Fine print under the row — renewal terms, delivery estimate. */
    note?: ReactNode;
    /** The figure the action commits to, beside it rather than above it, so it
        is read in the same glance as the button. */
    total?: {
        label: ReactNode;
        value: ReactNode;
    };
}
/**
 * The bar a purchase screen ends with: what it costs, and the button.
 *
 * It sticks to the bottom of the scroll container rather than the viewport, so
 * it belongs to the screen it is part of and cannot end up floating over an
 * unrelated one. It sits above the safe-area inset, and the content above owes
 * it room the way it does the tab bar.
 */
export declare function ActionBar({ action, className, note, total }: ActionBarProps): import("react").JSX.Element;
