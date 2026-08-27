import { ReactNode } from 'react';
export type SignInMethod = 'code' | 'password';
export interface SignInCopy {
    back: string;
    codeLabel: string;
    codeSubtitle: (destination: string) => ReactNode;
    codeTitle: string;
    identifierLabel: string;
    passwordLabel: string;
    passwordSubtitle: ReactNode;
    passwordTitle: string;
    phoneLabel: string;
    phoneSubtitle: ReactNode;
    phoneTitle: string;
    resend: string;
    resendIn: (seconds: number) => string;
    sendCode: string;
    signIn: string;
    usePassword: string;
    usePhone: string;
    verify: string;
}
export interface SignInFlowProps {
    brand?: ReactNode;
    className?: string;
    codeLength?: number;
    copy?: Partial<SignInCopy>;
    /** ISO 3166-1 alpha-2 the phone step opens on. */
    defaultCountry?: string;
    /** Which door the flow opens on. With both methods enabled the viewer can
        switch; with one, the other is never offered. */
    defaultMethod?: SignInMethod;
    /** Terms line, support link — under the action on every step. */
    footer?: ReactNode;
    methods?: SignInMethod[];
    /** Ask the backend for a code. Rejecting shows the message on the step. */
    onRequestCode?: (e164: string) => Promise<void> | void;
    /** Verify it. Resolving is success — routing afterwards is the caller's. */
    onVerifyCode?: (e164: string, code: string) => Promise<void> | void;
    onPasswordSignIn?: (identifier: string, password: string) => Promise<void> | void;
    /** Countries floated to the top of the picker. */
    priority?: string[];
    /** Seconds before "send it again" is offered. */
    resendSeconds?: number;
}
/**
 * The whole sign-in, ready to mount: phone → code, or email → password, with
 * the resend countdown, the loading and error states, and the step machine
 * already wired.
 *
 * The caller supplies three async functions and gets a working screen. Nothing
 * here knows about a router or an API client — `onVerifyCode` resolving *is*
 * success, and where the viewer goes next is the app's decision, made in one
 * place instead of at each of the flow's five exits.
 *
 * Compose `AuthScreen`, `PhoneField`, `OtpInput` and `PasswordField` by hand
 * instead when the product's flow differs — an invite code step, a captcha, a
 * tenant picker. This is the common shape, not the only one.
 */
export declare function SignInFlow({ brand, className, codeLength, copy, defaultCountry, defaultMethod, footer, methods, onPasswordSignIn, onRequestCode, onVerifyCode, priority, resendSeconds, }: SignInFlowProps): import("react").JSX.Element;
