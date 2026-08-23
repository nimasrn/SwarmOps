import { ReactNode } from 'react';
export type TaskStepStatus = 'active' | 'done' | 'failed' | 'pending' | 'skipped';
export interface TaskStep {
    /** What went wrong, or what is happening. Shown under the label — a status
        word alone leaves a stuck viewer with nothing to act on. */
    detail?: ReactNode;
    id: string;
    label: ReactNode;
    status: TaskStepStatus;
}
export interface TaskProgressProps {
    /** Rendered under the steps: a cancel control, a support line. */
    action?: ReactNode;
    className?: string;
    /** The headline under the ring — what the job is doing right now. */
    caption?: ReactNode;
    labels?: {
        of: (done: number, total: number) => string;
        status: Record<TaskStepStatus, string>;
    };
    steps: TaskStep[];
    title?: ReactNode;
    /** 0–100. Omit to derive it from the steps, which is what a job with equal
        stages wants; pass it when the server knows better. */
    value?: number;
}
/**
 * A long-running job the viewer is waiting on: a scan, an import, a render.
 *
 * The steps are the point. A bare percentage tells someone how long to wait;
 * a named stage tells them what is happening and, when it fails, which part
 * failed — which is the difference between "try again" and "try again with a
 * better photo". Failure is a state of a step, not a replacement for the list.
 *
 * The region is `aria-live="polite"`, so a stage completing is announced
 * without the viewer having to keep looking at it.
 */
export declare function TaskProgress({ action, caption, className, labels, steps, title, value, }: TaskProgressProps): import("react").JSX.Element;
