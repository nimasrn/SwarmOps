import { ReactNode } from 'react';
export type ToastTone = 'accent' | 'danger' | 'neutral' | 'success';
export interface ToastOptions {
    action?: {
        label: string;
        onPress: () => void;
    };
    /** Milliseconds on screen. Pass 0 to require a manual dismissal. */
    duration?: number;
    message: string;
    tone?: ToastTone;
}
export declare function ToastProvider({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
/** Throws when used outside the provider — a silent no-op would hide the bug. */
export declare function useToast(): (options: ToastOptions) => void;
