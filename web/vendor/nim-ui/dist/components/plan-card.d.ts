import { ReactNode } from 'react';
import { IconName } from './icon';
export interface PlanFeature {
    label: ReactNode;
    /** `included` is shipped, `pending` is bought but not released yet, and
        `excluded` is what this plan does not get. All three are worth showing:
        a plan card that lists only wins tells the viewer nothing to choose on. */
    state?: 'excluded' | 'included' | 'pending';
    /** A short status word beside a pending row — "soon", "beta". */
    note?: string;
}
export interface PlanCardProps {
    /** The one plan being recommended. At most one card in a set. */
    badge?: string;
    className?: string;
    features?: PlanFeature[];
    icon?: IconName;
    /** The headline figure, already formatted and localised by the caller. */
    price: ReactNode;
    /** What the price buys — "per month", "6 months". */
    priceCaption?: ReactNode;
    /** The comparable unit price, so plans of different lengths can be read
        against each other. */
    secondary?: {
        caption: ReactNode;
        value: ReactNode;
    };
    name: ReactNode;
    onSelect?: () => void;
    selected?: boolean;
    tagline?: ReactNode;
}
/**
 * One subscription tier, as a card the viewer chooses.
 *
 * The whole card is the control — a radio hidden behind a tap target the size
 * of a fingernail is the reason plan pickers feel fussy — so it renders as a
 * `<button>` with `aria-pressed` when selectable, and as a plain plate when it
 * is only being displayed.
 *
 * Prices are `ReactNode` rather than numbers: currency, digit shaping and
 * grouping are the product's locale decisions, and a kit that formats them
 * would be wrong in Persian first.
 */
export declare function PlanCard({ badge, className, features, icon, name, onSelect, price, priceCaption, secondary, selected, tagline, }: PlanCardProps): import("react").JSX.Element;
