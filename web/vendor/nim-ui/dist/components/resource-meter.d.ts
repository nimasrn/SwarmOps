import { HTMLAttributes, ReactNode } from 'react';
export type ResourceMeterTone = 'accent' | 'danger' | 'success' | 'warning';
export interface ResourceMeterProps extends HTMLAttributes<HTMLDivElement> {
    /** A concise description of the capacity being measured. */
    label: ReactNode;
    /** A readable measurement such as `18.4 / 32 GiB`; formatting stays in the product. */
    value: ReactNode;
    /** Optional secondary context, for example a node's one-minute load. */
    detail?: ReactNode;
    /** Percentage used, clamped to the meter's valid 0–100 range. Omit for capacity-only data. */
    percent?: number;
    tone?: ResourceMeterTone;
}
/**
 * A compact, accessible capacity reading for operator interfaces.
 *
 * `Progress` is intentionally unlabelled composition; a resource figure needs
 * its numerator, denominator, and qualitative state to travel together. The
 * product supplies formatting because bytes, vCPU, and retention windows do
 * not share a unit.
 */
export declare function ResourceMeter({ className, detail, label, percent, tone, value, ...props }: ResourceMeterProps): import("react").JSX.Element;
