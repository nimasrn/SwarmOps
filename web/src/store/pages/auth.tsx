import { useState } from 'react'
import type { FormEvent } from 'react'
import { AuthScreen, Banner, Button, Input, PasswordField, Stack as Rows } from '@nim.zone/ui'
import { useStore } from '../context'
import { errorMessage } from './shared'

export function SignInPage() {
  const { api, navigate, setSession, t } = useStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const registered = new URLSearchParams(window.location.search).has('registered')

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    setPending(true)
    setError('')
    try {
      setSession(await api.login(email, password))
      navigate('dashboard')
    } catch (reason) {
      setError(errorMessage(reason, t('common.error')))
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthScreen
      action={{ disabled: !email || !password, label: t('action.signIn'), loading: pending, onClick: () => void submit() }}
      footer={<Button onClick={() => navigate('register')} variant="ghost">{t('auth.noAccount')} {t('action.register')}</Button>}
      subtitle={t('auth.signInSubtitle')}
      title={t('auth.signInTitle')}
    >
      <form onSubmit={(event) => void submit(event)}>
        <Rows gap="md">
          {registered ? <Banner tone="success">{t('auth.registered')}</Banner> : null}
          {error ? <Banner tone="danger">{error}</Banner> : null}
          <Input autoComplete="email" dir="ltr" label={t('field.email')} onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
          <PasswordField autoComplete="current-password" label={t('field.password')} onChange={(event) => setPassword(event.target.value)} required value={password} />
          <button hidden type="submit" />
        </Rows>
      </form>
    </AuthScreen>
  )
}

export function RegisterPage() {
  const { api, navigate, setSession, t } = useStore()
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    setPending(true)
    setError('')
    try {
      await api.register(email, fullName, password)
      setSession(await api.login(email, password))
      navigate('wallet')
    } catch (reason) {
      setError(errorMessage(reason, t('common.error')))
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthScreen
      action={{ disabled: !email || !fullName || password.length < 10, label: t('action.register'), loading: pending, onClick: () => void submit() }}
      footer={<Button onClick={() => navigate('signin')} variant="ghost">{t('auth.haveAccount')} {t('action.signIn')}</Button>}
      subtitle={t('auth.registerSubtitle')}
      title={t('auth.registerTitle')}
    >
      <form onSubmit={(event) => void submit(event)}>
        <Rows gap="md">
          {error ? <Banner tone="danger">{error}</Banner> : null}
          <Input autoComplete="name" label={t('field.fullName')} onChange={(event) => setFullName(event.target.value)} required value={fullName} />
          <Input autoComplete="email" dir="ltr" label={t('field.email')} onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
          <PasswordField autoComplete="new-password" hint={t('auth.passwordHint')} label={t('field.password')} onChange={(event) => setPassword(event.target.value)} required value={password} />
          <button hidden type="submit" />
        </Rows>
      </form>
    </AuthScreen>
  )
}
