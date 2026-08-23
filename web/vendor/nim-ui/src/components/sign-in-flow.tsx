import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthScreen } from '@/components/auth-screen'
import { Banner } from '@/components/banner'
import { Button } from '@/components/button'
import { Input } from '@/components/field'
import { OtpInput } from '@/components/otp-input'
import { PasswordField } from '@/components/password-field'
import { PhoneField, toE164 } from '@/components/phone-field'

export type SignInMethod = 'code' | 'password'

export interface SignInCopy {
  back: string
  codeLabel: string
  codeSubtitle: (destination: string) => ReactNode
  codeTitle: string
  identifierLabel: string
  passwordLabel: string
  passwordSubtitle: ReactNode
  passwordTitle: string
  phoneLabel: string
  phoneSubtitle: ReactNode
  phoneTitle: string
  resend: string
  resendIn: (seconds: number) => string
  sendCode: string
  signIn: string
  usePassword: string
  usePhone: string
  verify: string
}

const DEFAULT_COPY: SignInCopy = {
  back: 'Back',
  codeLabel: 'Verification code',
  codeSubtitle: (destination) => `Enter the code we sent to ${destination}`,
  codeTitle: 'Verification code',
  identifierLabel: 'Email',
  passwordLabel: 'Password',
  passwordSubtitle: 'Use the email and password on your account.',
  passwordTitle: 'Sign in with a password',
  phoneLabel: 'Mobile number',
  phoneSubtitle: 'Enter your mobile number. We will text you a code — no password.',
  phoneTitle: 'Welcome',
  resend: 'Send the code again',
  resendIn: (seconds) => `You can ask for a new code in ${seconds}s`,
  sendCode: 'Send code',
  signIn: 'Sign in',
  usePassword: 'Sign in with a password instead',
  usePhone: 'Sign in with a code instead',
  verify: 'Verify and sign in',
}

export interface SignInFlowProps {
  brand?: ReactNode
  className?: string
  codeLength?: number
  copy?: Partial<SignInCopy>
  /** ISO 3166-1 alpha-2 the phone step opens on. */
  defaultCountry?: string
  /** Which door the flow opens on. With both methods enabled the viewer can
      switch; with one, the other is never offered. */
  defaultMethod?: SignInMethod
  /** Terms line, support link — under the action on every step. */
  footer?: ReactNode
  methods?: SignInMethod[]
  /** Ask the backend for a code. Rejecting shows the message on the step. */
  onRequestCode?: (e164: string) => Promise<void> | void
  /** Verify it. Resolving is success — routing afterwards is the caller's. */
  onVerifyCode?: (e164: string, code: string) => Promise<void> | void
  onPasswordSignIn?: (identifier: string, password: string) => Promise<void> | void
  /** Countries floated to the top of the picker. */
  priority?: string[]
  /** Seconds before "send it again" is offered. */
  resendSeconds?: number
}

const messageOf = (error: unknown, fallback: string) =>
  error instanceof Error && error.message.trim() ? error.message.trim() : fallback

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
export function SignInFlow({
  brand,
  className,
  codeLength = 5,
  copy,
  defaultCountry = 'IR',
  defaultMethod = 'code',
  footer,
  methods = ['code', 'password'],
  onPasswordSignIn,
  onRequestCode,
  onVerifyCode,
  priority = ['IR', 'AE', 'TR', 'DE', 'US', 'GB'],
  resendSeconds = 60,
}: SignInFlowProps) {
  const text = { ...DEFAULT_COPY, ...copy }
  const [method, setMethod] = useState<SignInMethod>(
    methods.includes(defaultMethod) ? defaultMethod : methods[0],
  )
  const [sent, setSent] = useState(false)
  const [country, setCountry] = useState(defaultCountry)
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0)
  const verifying = useRef(false)

  useEffect(() => {
    if (countdown <= 0) return
    const timer = window.setTimeout(() => setCountdown((seconds) => seconds - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [countdown])

  const e164 = toE164(country, phone)
  const phoneReady = phone.replace(/\D/g, '').length >= 6

  const requestCode = useCallback(
    async (resend = false) => {
      if (busy || (!resend && !phoneReady)) return
      setBusy(true)
      setError('')
      try {
        await onRequestCode?.(e164)
        setSent(true)
        setCode('')
        setCountdown(resendSeconds)
      } catch (failure) {
        setError(messageOf(failure, text.sendCode))
      } finally {
        setBusy(false)
      }
    },
    [busy, e164, onRequestCode, phoneReady, resendSeconds, text.sendCode],
  )

  const verify = useCallback(
    async (value: string) => {
      // Auto-submit on the last digit and the button can fire together; the
      // guard is a ref because both land in the same render.
      if (verifying.current || value.length !== codeLength) return
      verifying.current = true
      setBusy(true)
      setError('')
      try {
        await onVerifyCode?.(e164, value)
      } catch (failure) {
        setError(messageOf(failure, text.verify))
        setCode('')
      } finally {
        verifying.current = false
        setBusy(false)
      }
    },
    [codeLength, e164, onVerifyCode, text.verify],
  )

  const signInWithPassword = useCallback(async () => {
    if (busy || !identifier.trim() || !password) return
    setBusy(true)
    setError('')
    try {
      await onPasswordSignIn?.(identifier.trim(), password)
    } catch (failure) {
      setError(messageOf(failure, text.signIn))
    } finally {
      setBusy(false)
    }
  }, [busy, identifier, onPasswordSignIn, password, text.signIn])

  const switcher =
    methods.length > 1 ? (
      <Button
        onClick={() => {
          setMethod(method === 'code' ? 'password' : 'code')
          setError('')
        }}
        size="sm"
        variant="ghost"
      >
        {method === 'code' ? text.usePassword : text.usePhone}
      </Button>
    ) : null

  const notice = error ? <Banner tone="danger">{error}</Banner> : null

  if (method === 'password') {
    return (
      <AuthScreen
        action={{
          disabled: !identifier.trim() || !password,
          label: text.signIn,
          loading: busy,
          onClick: () => void signInWithPassword(),
        }}
        brand={brand}
        className={className}
        footer={
          <>
            {switcher}
            {footer}
          </>
        }
        subtitle={text.passwordSubtitle}
        title={text.passwordTitle}
      >
        {notice}
        <Input
          autoComplete="username"
          label={text.identifierLabel}
          onChange={(event) => setIdentifier(event.target.value)}
          type="email"
          value={identifier}
        />
        <PasswordField
          autoComplete="current-password"
          label={text.passwordLabel}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void signInWithPassword()
          }}
          value={password}
        />
      </AuthScreen>
    )
  }

  if (sent) {
    return (
      <AuthScreen
        action={{
          disabled: code.length !== codeLength,
          label: text.verify,
          loading: busy,
          onClick: () => void verify(code),
        }}
        back={{
          label: text.back,
          onClick: () => {
            setSent(false)
            setCode('')
            setError('')
          },
        }}
        className={className}
        footer={
          <>
            {countdown > 0 ? (
              <p>{text.resendIn(countdown)}</p>
            ) : (
              <Button onClick={() => void requestCode(true)} size="sm" variant="ghost">
                {text.resend}
              </Button>
            )}
            {footer}
          </>
        }
        subtitle={text.codeSubtitle(e164)}
        title={text.codeTitle}
      >
        {notice}
        <OtpInput
          autoFocus
          label={text.codeLabel}
          length={codeLength}
          onChange={setCode}
          onComplete={(value) => void verify(value)}
          value={code}
        />
      </AuthScreen>
    )
  }

  return (
    <AuthScreen
      action={{
        disabled: !phoneReady,
        label: text.sendCode,
        loading: busy,
        onClick: () => void requestCode(),
      }}
      brand={brand}
      className={className}
      footer={
        <>
          {switcher}
          {footer}
        </>
      }
      subtitle={text.phoneSubtitle}
      title={text.phoneTitle}
    >
      {notice}
      <PhoneField
        country={country}
        label={text.phoneLabel}
        onChange={setPhone}
        onCountryChange={setCountry}
        onSubmit={() => void requestCode()}
        priority={priority}
        value={phone}
      />
    </AuthScreen>
  )
}
