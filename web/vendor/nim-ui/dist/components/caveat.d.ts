import { HTMLAttributes, ReactNode } from 'react';
export interface CaveatProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
    /** What the reader should understand is missing, in a few words.
     *  `title` is omitted from the base attributes on purpose: the DOM one is a
     *  string tooltip, and this is a rendered heading. */
    title?: ReactNode;
    children: ReactNode;
}
/**
 * A surface for what the product does not know.
 *
 * Consoles are usually built to project confidence, so the absence of a
 * measurement is either hidden or dressed as a zero. Both are lies an operator
 * eventually pays for. `Caveat` gives absence somewhere honest to live, and
 * marks it with a diagonal hatch — the convention surveyors have used for
 * unsurveyed ground for two centuries, and one that survives being printed,
 * screenshotted, or read by someone who cannot distinguish the status hues.
 *
 * It is deliberately quiet: a caveat is not a warning. A warning says something
 * is wrong; a caveat says something is unmeasured, which is a different claim
 * and must not compete with real alarms for attention.
 *
 * Use it for a genuine blind spot. A `Caveat` on every panel teaches the
 * operator to stop seeing them, and then the one that mattered is invisible too.
 */
export declare function Caveat({ children, className, title, ...props }: CaveatProps): import("react").JSX.Element;
