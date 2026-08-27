import { ReactNode } from 'react';
export interface AvatarRingProps {
    className?: string;
    /** What the ring is measuring, for assistive tech. */
    label: string;
    /** Initials, or a small caption under them. */
    caption?: ReactNode;
    /** Image URL. Falls back to `initials` when absent or broken. */
    src?: string;
    initials: string;
    size?: number;
    /** 0–100. The ring is the progress; the number belongs in the caption. */
    value: number;
}
/**
 * An avatar wearing a progress ring: profile completion, a skin score, a
 * streak — one figure the viewer is meant to want to finish.
 *
 * The ring is an SVG arc rather than a conic gradient so it keeps a rounded
 * cap and stays crisp at any size, and it carries `role="img"` with the label,
 * because the arc is the only place the value is stated for a sighted viewer.
 */
export declare function AvatarRing({ caption, className, initials, label, size, src, value, }: AvatarRingProps): import("react").JSX.Element;
export interface ProfileHeaderProps {
    /** The row of quick figures under the identity block. */
    stats?: {
        label: ReactNode;
        value: ReactNode;
    }[];
    /** Small pills: plan, skin type, billing cycle. */
    chips?: ReactNode;
    actions?: ReactNode;
    avatar: ReactNode;
    className?: string;
    /** The line above the name — "vlora account", the tenant, the role. */
    eyebrow?: ReactNode;
    name: ReactNode;
}
/**
 * The plate at the top of a profile: who this is, what they have, and the two
 * things they should do next.
 *
 * It is a header, not a dashboard. Anything that needs a chart or a list goes
 * in the sections beneath it — this block stays readable at a glance, which is
 * the only reason it earns the space it takes.
 */
export declare function ProfileHeader({ actions, avatar, chips, className, eyebrow, name, stats, }: ProfileHeaderProps): import("react").JSX.Element;
