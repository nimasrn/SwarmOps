import { ReactNode } from 'react';
import { PlanCardProps } from './plan-card';
export interface BillingCycle {
    id: string;
    label: string;
    /** "Save 15%" — the reason to pick the longer commitment. */
    note?: string;
}
export interface PlanOffer extends Omit<PlanCardProps, 'onSelect' | 'price' | 'secondary' | 'selected'> {
    id: string;
    /** Price per billing cycle, keyed by cycle id. Already formatted: currency
        and digit shaping are the product's locale decision, not the kit's. */
    prices: Record<string, {
        monthly?: ReactNode;
        price: ReactNode;
    }>;
}
export interface PlanPickerProps {
    className?: string;
    /** Billing periods. One cycle, or none at all, hides the switch. */
    cycles?: BillingCycle[];
    cycle?: string;
    defaultCycle?: string;
    defaultPlan?: string;
    labels?: {
        cycle: string;
        monthly: string;
        price: string;
    };
    /** Fine print under the action — renewal terms, store rules. */
    note?: ReactNode;
    onCycleChange?: (cycle: string) => void;
    onPlanChange?: (plan: string) => void;
    /** Fires with the chosen plan and cycle. Payment is the app's business. */
    onSubmit?: (plan: string, cycle: string) => void;
    plans: PlanOffer[];
    plan?: string;
    submitLabel?: string;
}
/**
 * The subscription screen: billing period, the tiers, and one action.
 *
 * Ready to mount — it holds the selection, keeps the cycle and the prices in
 * step, and hands `onSubmit` the pair the checkout needs. Pass `plan`/`cycle`
 * to drive it from outside instead, e.g. when a deep link opens the screen on
 * a specific tier.
 *
 * It deliberately does not take a payment handler, a store SDK, or a currency:
 * a plan picker that also knows how to charge is two screens welded together,
 * and only one of them is the same across products.
 */
export declare function PlanPicker({ className, cycle, cycles, defaultCycle, defaultPlan, labels, note, onCycleChange, onPlanChange, onSubmit, plan, plans, submitLabel, }: PlanPickerProps): import("react").JSX.Element;
