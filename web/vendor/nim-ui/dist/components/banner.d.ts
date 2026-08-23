import { HTMLAttributes, ReactNode } from 'react';
import { IconName } from './icon';
export type BannerTone = 'accent' | 'danger' | 'info' | 'neutral' | 'success' | 'warning';
export interface BannerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
    action?: ReactNode;
    children: ReactNode;
    icon?: IconName;
    title?: ReactNode;
    tone?: BannerTone;
}
export declare function Banner({ action, children, className, icon, title, tone, ...props }: BannerProps): import("react").JSX.Element;
