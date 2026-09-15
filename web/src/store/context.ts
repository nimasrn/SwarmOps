import { createContext, useContext } from 'react'
import type { CloudSession } from '../data/types'
import type { StoreAPI } from './api'
import type { Locale, Translate } from './i18n'

export type StoreRoute =
  | { name: 'plans' }
  | { name: 'signin' }
  | { name: 'register' }
  | { name: 'dashboard' }
  | { name: 'wallet' }
  | { name: 'checkout'; plan: string }
  | { name: 'orders' }
  | { name: 'projects' }
  | { name: 'invoices' }
  | { name: 'support' }

export interface StoreContextValue {
  api: StoreAPI
  date: (value?: string) => string
  locale: Locale
  money: (rial: number) => string
  navigate: (path: string) => void
  session: CloudSession | null
  setSession: (session: CloudSession | null) => void
  t: Translate
}

export const StoreContext = createContext<StoreContextValue | null>(null)

export function useStore(): StoreContextValue {
  const value = useContext(StoreContext)
  if (!value) throw new Error('useStore must be used inside the storefront')
  return value
}

/** Every storefront address is a hash, so the controller serves one page. */
export function parseStoreRoute(hash: string): StoreRoute {
  const [name = '', detail = ''] = hash.replace(/^#\/?/, '').split('/')
  switch (name) {
    case 'signin':
    case 'register':
    case 'dashboard':
    case 'wallet':
    case 'orders':
    case 'projects':
    case 'invoices':
    case 'support':
      return { name }
    case 'checkout':
      return detail ? { name: 'checkout', plan: decodeURIComponent(detail) } : { name: 'plans' }
    default:
      return { name: 'plans' }
  }
}
