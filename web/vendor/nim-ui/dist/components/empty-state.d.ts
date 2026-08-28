import { HTMLAttributes, ReactNode } from 'react';
import { IconName } from './icon';
export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
    actions?: ReactNode;
    description?: ReactNode;
    icon?: IconName;
    title: ReactNode;
    /** Why there is nothing here, and the two are not the same claim:
     *
     *  `empty`   — the thing was asked and the answer is none. A cluster with no
     *              stacks has no stacks.
     *  `unknown` — the thing could not be asked. No agent answered, no collector
     *              is installed, the API refused.
     *
     *  A console that renders both identically teaches its operators that an
     *  empty table means "nothing there", and one day that reading is wrong in
     *  an expensive way. `unknown` is hatched so the difference survives a
     *  screenshot. */
    reason?: 'empty' | 'unknown';
}
export declare function EmptyState({ actions, className, description, icon, reason, title, ...props }: EmptyStateProps): import("react").JSX.Element;
