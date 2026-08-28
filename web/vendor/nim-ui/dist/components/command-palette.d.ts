import { ReactNode } from 'react';
import { IconName } from './icon';
export interface PaletteCommand {
    disabled?: boolean;
    /** Heading the command is filed under. Commands keep the order they are
        given; a group is drawn where its first member appears. */
    group?: string;
    /** The second line — what choosing this does, not a repeat of the label. */
    hint?: ReactNode;
    icon?: IconName;
    id: string;
    /** Extra words the command should match on, never drawn. Synonyms and the
        old name of a screen belong here, so a rename does not make a
        destination unfindable by the name the operator still uses. */
    keywords?: string;
    label: string;
    onRun: () => void;
    /** Drawn in the mono on the trailing edge — a hint, never a binding. */
    shortcut?: string;
}
export interface CommandPaletteProps {
    className?: string;
    commands: PaletteCommand[];
    emptyLabel?: (query: string) => ReactNode;
    /** Accessible name of the surface, and the heading above the field. */
    label: string;
    onClose: () => void;
    open: boolean;
    placeholder?: string;
}
/**
 * The console's keyboard surface: one field, one ranked list, one action.
 *
 * It is deliberately NOT a Combobox with a wider box. A combobox edits a
 * field's value and its result is a selection; a palette runs something and
 * leaves no value behind — which is why its rows carry an icon, a purpose and
 * a shortcut, and why closing it is the normal end of every interaction.
 *
 * The surface is a real `<dialog>` opened with `showModal()`, so the top
 * layer, the focus trap, the inert background and Escape come from the
 * platform. The hotkey that OPENS it is the app's: a component that bound a
 * global key would collide with every other consumer on the page, and which
 * chord an app spends is a product decision.
 */
export declare function CommandPalette({ className, commands, emptyLabel, label, onClose, open, placeholder, }: CommandPaletteProps): import("react").JSX.Element;
