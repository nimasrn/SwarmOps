import { InputHTMLAttributes } from 'react';
export interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
    label?: string;
    max?: number;
    min?: number;
    /** Rendered beneath the track, evenly spaced — e.g. ['1M', '8M', '15M']. */
    scale?: string[];
    value: number;
}
export declare function Slider({ className, label, max, min, scale, step, value, ...props }: SliderProps): import("react").JSX.Element;
