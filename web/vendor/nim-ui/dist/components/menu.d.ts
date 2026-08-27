import { ReactElement, ReactNode, Ref, RefObject } from 'react';
import { IconName } from './icon';
export interface MenuAction {
    danger?: boolean;
    disabled?: boolean;
    icon?: IconName;
    kind?: 'action';
    label: string;
    onSelect: () => void;
    /** Rendered in the mono, on the trailing edge — a hint, never a binding. */
    shortcut?: string;
}
export interface MenuHeading {
    kind: 'heading';
    label: string;
}
export interface MenuSeparator {
    kind: 'separator';
}
export type MenuItem = MenuAction | MenuHeading | MenuSeparator;
export interface MenuProps {
    /** The trigger is the caller's, so the menu has no opinion about what opens
        it — it only needs the ref to anchor against. */
    children: (props: {
        open: boolean;
        ref: Ref<HTMLButtonElement>;
        toggle: () => void;
    }) => ReactElement;
    className?: string;
    items: MenuItem[];
    label: string;
}
/**
 * A list of actions, dismissed by choosing one. A menu holds actions and never
 * inputs — something the viewer types into is a Popover.
 *
 * The trigger is supplied by the caller as a render prop so the menu never has
 * an opinion about what opens it; it only needs the ref to anchor against.
 * Arrow keys move a roving active item, Enter and Space choose it, Escape and
 * an outside click dismiss, and focus returns to the trigger either way.
 */
export declare function Menu({ children, className, items, label }: MenuProps): import("react").JSX.Element;
export interface PopoverProps {
    children: ReactNode;
    className?: string;
    label: string;
    onClose: () => void;
    open: boolean;
    /** The element the panel is placed against. */
    triggerRef: RefObject<HTMLElement | null>;
}
/**
 * A menu's geometry with a form's contents. Unlike a menu it does not close on
 * a click inside, because the thing inside is what the viewer came for.
 */
export declare function Popover({ children, className, label, onClose, open, triggerRef }: PopoverProps): import('react').ReactPortal | null;
