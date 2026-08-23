import { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { IconName } from './icon';
export interface FieldShellProps {
    children: (ids: {
        control: string;
        describedBy?: string;
    }) => ReactNode;
    className?: string;
    error?: string;
    hint?: string;
    id?: string;
    label?: string;
    required?: boolean;
}
/**
 * Every nim form control shares this frame, which is what guarantees that a
 * label, a hint, and an error are wired to the control with the right ids on
 * every screen — the part teams most often get wrong by hand.
 */
export declare function FieldShell({ children, className, error, hint, id, label, required }: FieldShellProps): import("react").JSX.Element;
export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
    error?: string;
    hint?: string;
    iconEnd?: IconName;
    iconStart?: IconName;
    label?: string;
}
export declare function Input({ className, error, hint, iconEnd, iconStart, id, label, required, ...props }: InputProps): import("react").JSX.Element;
export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    error?: string;
    hint?: string;
    label?: string;
}
export declare function Textarea({ className, error, hint, id, label, required, rows, ...props }: TextareaProps): import("react").JSX.Element;
export interface SelectOption {
    disabled?: boolean;
    label: string;
    value: string;
}
export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
    error?: string;
    hint?: string;
    label?: string;
    options: SelectOption[];
    placeholder?: string;
}
export declare function Select({ className, error, hint, id, label, options, placeholder, required, ...props }: SelectProps): import("react").JSX.Element;
