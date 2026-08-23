import { InputHTMLAttributes, ReactNode } from 'react';
interface ChoiceBaseProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
    children: ReactNode;
    description?: string;
}
export type CheckboxProps = ChoiceBaseProps;
export type SwitchProps = ChoiceBaseProps;
/**
 * Both controls keep a real `<input>` in the tree — visually hidden but
 * focusable — so keyboard behaviour, form participation, and assistive tech
 * come from the platform rather than from re-implemented ARIA.
 */
export declare function Checkbox({ children, className, description, ...props }: CheckboxProps): import("react").JSX.Element;
export declare function Switch({ children, className, description, ...props }: SwitchProps): import("react").JSX.Element;
export interface RadioProps extends ChoiceBaseProps {
    value: string;
}
/**
 * A radio is never alone — it is one answer among a set, and the set is what
 * assistive tech announces ("2 of 4"). `RadioGroup` supplies the name and the
 * grouping; a bare `Radio` outside one is valid markup but a broken control,
 * so the group is the documented entry point.
 */
export declare function Radio({ children, className, description, ...props }: RadioProps): import("react").JSX.Element;
export interface RadioGroupProps {
    children: ReactNode;
    className?: string;
    error?: string;
    hint?: string;
    label: string;
    /** Rows by default; `inline` puts the answers on one line when they are short. */
    layout?: 'inline' | 'stack';
    /** Left unset, a name is generated — two groups on a page never collide. */
    name?: string;
    onChange: (value: string) => void;
    value: string;
}
/**
 * A `<fieldset>` with a real `<legend>`, because the question a radio set asks
 * has to be announced before the answers — a paragraph above the group reads
 * as unrelated text to a screen reader.
 */
export declare function RadioGroup({ children, className, error, hint, label, layout, name, onChange, value, }: RadioGroupProps): import("react").JSX.Element;
export {};
