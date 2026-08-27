import { ReactNode } from 'react';
export interface OnboardingSlide {
    /** Illustration, video, or anything else. Sized by the caller. */
    art?: ReactNode;
    body?: ReactNode;
    id: string;
    /** The chip above the title — the promise, in three or four words. */
    label?: string;
    /** A caption card under the art: a headline and its supporting points. */
    proof?: {
        icon?: ReactNode;
        points?: string[];
        title: ReactNode;
    };
    title: ReactNode;
}
export interface OnboardingProps {
    className?: string;
    /** Label for the button on the last slide. */
    finishLabel: string;
    /** Label for the button on every other slide. */
    nextLabel: string;
    /** Reached from the finish button, or from skip. */
    onDone: () => void;
    onSkip?: () => void;
    /** Notified on every slide change, including from a dot. */
    onStep?: (index: number) => void;
    slides: OnboardingSlide[];
    skipLabel?: string;
    /** Version string, support line — whatever sits under the CTA. */
    footnote?: ReactNode;
    /** Brand mark in the top bar. */
    brand?: ReactNode;
    /** Accessible names for the controls. */
    labels?: {
        back: string;
        dot: (index: number) => string;
    };
}
/**
 * The three-screen intro a product opens with: art, a promise, a body, and one
 * CTA that advances.
 *
 * State is the component's, because a first-run carousel is never resumed from
 * a URL — `onStep` reports it for analytics and `onDone` fires when the viewer
 * either finishes or skips, so the caller routes in one place instead of two.
 * Slides are announced through a live region rather than by moving focus,
 * which would yank a screen reader out of the CTA it is already on.
 */
export declare function Onboarding({ brand, className, finishLabel, footnote, labels, nextLabel, onDone, onSkip, onStep, skipLabel, slides, }: OnboardingProps): import("react").JSX.Element;
