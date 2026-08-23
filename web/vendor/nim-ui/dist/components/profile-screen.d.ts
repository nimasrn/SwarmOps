import { ReactNode } from 'react';
import { ProfileHeaderProps } from './profile-header';
import { IconName } from './icon';
export interface ProfileRow {
    /** A switch instead of a chevron. With `onToggle` the row is the control. */
    checked?: boolean;
    danger?: boolean;
    href?: string;
    icon?: IconName;
    key: string;
    label: ReactNode;
    onSelect?: () => void;
    onToggle?: (next: boolean) => void;
    subtitle?: ReactNode;
    /** A badge, a count, a version string. */
    value?: ReactNode;
}
export interface ProfileSection {
    description?: ReactNode;
    key: string;
    rows: ProfileRow[];
    title?: ReactNode;
}
export interface ProfileScreenProps extends ProfileHeaderProps {
    className?: string;
    /** Sign out, delete account — whatever ends the session, kept away from the
        rows above so it is never the thing a thumb reaches by accident. */
    footer?: ReactNode;
    sections?: ProfileSection[];
}
/**
 * The account screen: the identity plate, then grouped rows of settings.
 *
 * Ready to mount — hand it the header's props and a list of sections and it is
 * the screen. Rows are declared, not composed, so the whole of a settings page
 * is data the app already has: a label, an icon, and either somewhere to go or
 * something to toggle.
 *
 * State stays the caller's. A switch here reports the change and redraws from
 * the prop, because the truth about whether notifications are on lives on a
 * server, and a row that flips optimistically and then disagrees with it is
 * worse than one that waits.
 */
export declare function ProfileScreen({ className, footer, sections, ...header }: ProfileScreenProps): import("react").JSX.Element;
