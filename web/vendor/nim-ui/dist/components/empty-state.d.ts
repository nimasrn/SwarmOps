import { HTMLAttributes, ReactNode } from 'react';
import { IconName } from './icon';
export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
    actions?: ReactNode;
    description?: ReactNode;
    icon?: IconName;
    title: ReactNode;
}
export declare function EmptyState({ actions, className, description, icon, title, ...props }: EmptyStateProps): import("react").JSX.Element;
