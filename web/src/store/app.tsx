import { useEffect, useMemo, useState } from 'react'
import { Button, Caption, Inline, NimProvider, Page, Segmented, Stack as Rows, Tabs, Title } from '@nim.zone/ui'
import type { CloudSession } from '../data/types'
import { formatMoney } from '../lib/format'
import { StoreAPI } from './api'
import { StoreContext, parseStoreRoute, useStore, type StoreContextValue, type StoreRoute } from './context'
import { initialLocale, rememberLocale, translator, type Locale, type MessageKey } from './i18n'
import { CataloguePage, CheckoutPage } from './pages/catalogue'
import { RegisterPage, SignInPage } from './pages/auth'
import { DashboardPage, WalletPage } from './pages/account'
import { OrdersPage, ProjectsPage } from './pages/orders'
import { InvoicesPage } from './pages/invoices'
import { SupportPage } from './pages/support'

const api = new StoreAPI()

/**
 * The SwarmOps Cloud storefront. It holds the language above the kit's
 * provider, because switching to Persian changes the document direction and
 * the digits of every number, not only the words.
 */
export function StoreRoot() {
  const [locale, setLocale] = useState<Locale>(initialLocale)
  const changeLocale = (next: Locale) => {
    rememberLocale(next)
    setLocale(next)
  }
  return (
    <NimProvider defaultColorway="malachite" defaultScheme="system" defaultStyle="console" direction={locale === 'fa' ? 'rtl' : 'ltr'} locale={locale === 'fa' ? 'fa-IR' : 'en'}>
      <StoreApp locale={locale} onLocaleChange={changeLocale} />
    </NimProvider>
  )
}

const ACCOUNT_SECTIONS = ['dashboard', 'wallet', 'orders', 'projects', 'invoices', 'support'] as const
type AccountSection = typeof ACCOUNT_SECTIONS[number]

function StoreApp({ locale, onLocaleChange }: { locale: Locale; onLocaleChange: (locale: Locale) => void }) {
  const [route, setRoute] = useState<StoreRoute>(() => parseStoreRoute(window.location.hash))
  const [session, setSession] = useState<CloudSession | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const onHash = () => setRoute(parseStoreRoute(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    void api.me().then(setSession).catch(() => setSession(null)).finally(() => setChecking(false))
  }, [])

  const context = useMemo<StoreContextValue>(() => {
    const dates = new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    return {
      api,
      date: (value) => (value ? dates.format(new Date(value)) : '—'),
      locale,
      money: (rial) => formatMoney(rial, locale),
      navigate: (path) => { window.location.hash = `/${path}` },
      session,
      setSession,
      t: translator(locale),
    }
  }, [locale, session])
  const { t } = context

  const needsSession = ACCOUNT_SECTIONS.includes(route.name as AccountSection) || route.name === 'checkout'
  useEffect(() => {
    if (!checking && needsSession && !session) context.navigate('signin')
    if (!checking && session && (route.name === 'signin' || route.name === 'register')) context.navigate('dashboard')
  }, [checking, context, needsSession, route.name, session])

  const signOut = async () => {
    await api.logout().catch(() => undefined)
    setSession(null)
    context.navigate('plans')
  }

  return (
    <StoreContext.Provider value={context}>
      <Page width="wide">
        <Rows gap="loose">
          <Inline wrap>
            <Rows gap="tight">
              <Title as="h1">{t('brand')}</Title>
              <Caption tone="muted">{t('tagline')}</Caption>
            </Rows>
            <Inline gap="tight" wrap>
              <Segmented
                label={t('common.language')}
                onChange={(value) => onLocaleChange(value)}
                options={[{ label: 'English', value: 'en' }, { label: 'فارسی', value: 'fa' }]}
                value={locale}
              />
              {session
                ? <Button onClick={() => void signOut()} variant="secondary">{t('action.signOut')}</Button>
                : <Button onClick={() => context.navigate('signin')}>{t('action.signIn')}</Button>}
            </Inline>
          </Inline>
          <Tabs
            label={t('nav.label')}
            onChange={(value) => context.navigate(value)}
            options={[
              { label: t('nav.plans'), value: 'plans' },
              ...(session ? ACCOUNT_SECTIONS.map((section) => ({ label: t(`nav.${section}` as MessageKey), value: section })) : []),
            ]}
            value={route.name === 'checkout' ? 'plans' : route.name === 'signin' || route.name === 'register' ? 'plans' : route.name}
          />
          {checking && needsSession ? <Caption tone="muted">{t('common.loading')}</Caption> : <RouteView route={route} />}
          <Caption tone="muted">{t('footer')}</Caption>
        </Rows>
      </Page>
    </StoreContext.Provider>
  )
}

function RouteView({ route }: { route: StoreRoute }) {
  const { session } = useStore()
  switch (route.name) {
    case 'signin':
      return <SignInPage />
    case 'register':
      return <RegisterPage />
    case 'checkout':
      return session ? <CheckoutPage planCode={route.plan} /> : null
    case 'dashboard':
      return session ? <DashboardPage /> : null
    case 'wallet':
      return session ? <WalletPage /> : null
    case 'orders':
      return session ? <OrdersPage /> : null
    case 'projects':
      return session ? <ProjectsPage /> : null
    case 'invoices':
      return session ? <InvoicesPage /> : null
    case 'support':
      return session ? <SupportPage /> : null
    default:
      return <CataloguePage />
  }
}
