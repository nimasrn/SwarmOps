import { HTMLAttributes } from 'react';
export type DiffKind = 'added' | 'context' | 'removed';
export interface DiffLine {
    kind: DiffKind;
    text: string;
}
export interface DiffProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
    lines: DiffLine[];
    /** Names what is being compared, for example `api-gateway · 7c41b8e → 9f2c1ab`. */
    caption?: string;
    /** Announced to assistive technology in place of reading every marker. */
    summary?: string;
}
/**
 * A before-and-after of a specification, shown before it is applied.
 *
 * `CodeBlock` renders a file; this renders a CHANGE, and the difference
 * matters: an operator approving a deploy is not reading the spec, they are
 * reading what moved. Context lines are dimmed so the eye lands on the two or
 * three lines that are actually the decision.
 *
 * The marker column carries `+` and `-` as text rather than colour alone. A
 * diff distinguished only by red and green fails for roughly one man in twelve,
 * fails in print, and fails in a screenshot pasted into an incident channel —
 * which is precisely where a diff ends up.
 */
export declare function Diff({ caption, className, lines, summary, ...props }: DiffProps): import("react").JSX.Element;
