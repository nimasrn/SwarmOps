import { HTMLAttributes, ReactNode } from 'react';
export interface SectionHeaderProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
    action?: ReactNode;
    description?: ReactNode;
    eyebrow?: ReactNode;
    title: ReactNode;
}
export declare function SectionHeader({ action, className, description, eyebrow, title, ...props }: SectionHeaderProps): import("react").JSX.Element;
