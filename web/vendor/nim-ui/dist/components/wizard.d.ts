import { ReactNode } from 'react';
export interface WizardStep {
    /** The step itself. A function receives nothing — the caller already holds
        the answers, because they are the app's, not the wizard's. */
    content: ReactNode;
    /** Blocks the CTA until the step is answered. */
    canContinue?: boolean;
    /** Overrides the CTA label on this step alone. */
    continueLabel?: string;
    id: string;
    /** The one thing being asked. Kept short: a wizard step is a question. */
    question?: ReactNode;
    subtitle?: ReactNode;
}
export interface WizardProps {
    className?: string;
    continueLabel: string;
    /** Label on the last step. */
    finishLabel: string;
    labels?: {
        back: string;
        close: string;
        step: (index: number, total: number) => string;
    };
    onClose?: () => void;
    /** Fired from the last step's CTA. */
    onDone: () => void;
    /** Every step change, including backwards — for analytics and autosave. */
    onStep?: (index: number) => void;
    steps: WizardStep[];
}
/**
 * A short, one-question-per-screen flow: mood → cause → note, or any other
 * sequence a viewer walks once and abandons easily.
 *
 * The step index is the wizard's; the answers are not. A wizard that owned the
 * answers would have to know their shape, and every product's are different —
 * so each step is given its content and reports back through `canContinue`,
 * which is the only thing the shell needs to know.
 *
 * Progress is dots rather than a bar: a bar implies a percentage of work done,
 * and three questions are three questions. The close control is always present
 * — a flow the viewer cannot leave is a trap, and leaving is the most common
 * thing anyone does with one of these.
 */
export declare function Wizard({ className, continueLabel, finishLabel, labels, onClose, onDone, onStep, steps, }: WizardProps): import("react").JSX.Element;
export interface ChoiceGridOption {
    disabled?: boolean;
    icon?: ReactNode;
    id: string;
    label: ReactNode;
}
export interface ChoiceGridProps {
    className?: string;
    /** Cap a multi-select. Options past the cap disable rather than disappear,
        so the grid does not reflow under the viewer's finger. */
    max?: number;
    multiple?: boolean;
    onChange: (selected: string[]) => void;
    options: ChoiceGridOption[];
    selected: string[];
}
/**
 * The grid of icon tiles a wizard step is usually made of.
 *
 * Single-select renders radios and multi-select renders checkboxes — stated in
 * ARIA rather than implied by how many are lit, because "pick one" and "pick
 * any" are different promises and only one of them is visible in a grid.
 */
export declare function ChoiceGrid({ className, max, multiple, onChange, options, selected, }: ChoiceGridProps): import("react").JSX.Element;
