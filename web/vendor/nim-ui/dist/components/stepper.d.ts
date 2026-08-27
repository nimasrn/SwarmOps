export interface StepperProps {
    className?: string;
    decrementLabel?: string;
    incrementLabel?: string;
    label: string;
    max?: number;
    min?: number;
    onChange: (value: number) => void;
    step?: number;
    value: number;
}
/**
 * A number with two full-size targets. Both buttons are control-height
 * squares, so the pair clears the touch minimum rather than shrinking into the
 * cramped ± chevrons this control usually becomes.
 */
export declare function Stepper({ className, decrementLabel, incrementLabel, label, max, min, onChange, step, value, }: StepperProps): import("react").JSX.Element;
