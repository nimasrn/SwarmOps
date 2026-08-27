import { HTMLAttributes } from 'react';
export type AvatarSize = 'lg' | 'md' | 'sm';
export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
    /** Falls back to initials derived from `name` when no image is supplied. */
    name: string;
    shape?: 'round' | 'square';
    size?: AvatarSize;
    src?: string;
}
export declare function Avatar({ className, name, shape, size, src, ...props }: AvatarProps): import("react").JSX.Element;
