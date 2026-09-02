import type { Dispatch, SetStateAction } from 'react'
import type { BadgeVariant, useToast } from '@nim.zone/ui'
import type {
  Command,
  DNSCredentialMetadata,
  DNSRecordSpec,
  RouteProtocol,
  RouteSpec,
  ServiceRouteRole,
  TraefikSettings,
} from '../../data/types'

type Toast = ReturnType<typeof useToast>

/**
 * The pure parts of the traffic screens: shaping a route spec, naming a
 * confirmation phrase, and turning a status word into a badge.
 *
 * They live apart from the screens because all four traffic screens share
 * them, and because a phrase the server will check is a rule rather than a
 * rendering decision — it belongs where it can be read on its own.
 */

export function protocolPatch(protocol: RouteProtocol): Partial<RouteSpec> {
  if (protocol === 'http') return { listenPort: 0, match: { hosts: ['service.example.com'], pathPrefix: '/' }, protocol, tls: 'off', health: { kind: 'response', path: '/', timeoutSeconds: 5 } }
  if (protocol === 'tcp') return { match: {}, protocol, health: { kind: 'handshake', timeoutSeconds: 5 } }
  return { match: {}, protocol, tls: 'off', resolver: '', health: { kind: 'structural', timeoutSeconds: 5 } }
}

export function updateRoute(setter: Dispatch<SetStateAction<RouteSpec | null>>, patch: Partial<RouteSpec>) {
  setter((current) => current ? { ...current, ...patch } : current)
}

export function updateResolver(setter: Dispatch<SetStateAction<TraefikSettings>>, index: number, patch: Partial<TraefikSettings['resolvers'][number]>) {
  setter((current) => ({ ...current, resolvers: current.resolvers.map((resolver, resolverIndex) => resolverIndex === index ? { ...resolver, ...patch } : resolver) }))
}

export function cloneRoute(route: RouteSpec): RouteSpec {
  return { ...route, health: { ...route.health }, match: { ...route.match, hosts: [...(route.match.hosts ?? [])], sni: [...(route.match.sni ?? [])] } }
}

export function cloneSettings(settings: TraefikSettings): TraefikSettings {
  return { ...settings, entryPoints: settings.entryPoints.map((entry) => ({ ...entry })), portRange: { ...settings.portRange }, resolvers: settings.resolvers.map((resolver) => ({ ...resolver })) }
}

export function normalizeDashboardHostname(value: string) {
  return value.trim().toLowerCase().replace(/\.$/, '')
}

export function validDashboardHostname(value: string) {
  const hostname = normalizeDashboardHostname(value)
  if (!hostname || hostname.length > 253 || hostname.includes('/') || hostname.includes(':') || hostname.includes('@') || hostname.includes('?') || hostname.includes('#')) return false
  const parts = hostname.split('.')
  return parts.length >= 2 && parts.every((part) => part.length > 0 && part.length <= 63 && !part.startsWith('-') && !part.endsWith('-') && /^[a-z0-9-]+$/.test(part))
}

export function latestCredentialVersions(credentials: DNSCredentialMetadata[]) {
  const latest = new Map<string, DNSCredentialMetadata>()
  for (const credential of credentials) if (credential.state !== 'removed' && (!latest.has(credential.id) || credential.version > latest.get(credential.id)!.version)) latest.set(credential.id, credential)
  return [...latest.values()].sort((left, right) => left.name.localeCompare(right.name))
}

export function removableCredentialVersions(credentials: DNSCredentialMetadata[]) {
  const latest = new Map<string, number>()
  for (const credential of credentials) {
    if (credential.state === 'removed') continue
    if (!latest.has(credential.id) || credential.version > latest.get(credential.id)!) {
      latest.set(credential.id, credential.version)
    }
  }
  return credentials.filter((credential) => credential.state !== 'removed' && credential.version < (latest.get(credential.id) ?? 0)).sort((left, right) => left.id.localeCompare(right.id) || left.version - right.version)
}

export function providerForCredential(credentials: DNSCredentialMetadata[], id: string) {
  return credentials.find((credential) => credential.id === id)?.provider
}

export function emptyDNSRecord(credentialId: string): DNSRecordSpec {
  return { adopted: false, content: '', credentialId, id: '', managed: true, name: '', proxied: false, ttl: 300, type: 'A', version: 1, zone: '' }
}

export function routeConfirmation(route: RouteSpec, restartRequired: boolean) {
  return routeConfirmations(route, restartRequired).join(' + ')
}

export function routeConfirmationLabel(route: RouteSpec, restartRequired: boolean) {
  const required = routeConfirmations(route, restartRequired)
  if (!required.length) return 'no phrase for this dynamic non-sensitive change'
  return required.join(' + ')
}

export function routeConfirmationHint(route: RouteSpec, restartRequired: boolean) {
  return `Type ${routeConfirmationLabel(route, restartRequired)}`
}

export function routeConfirmations(route: RouteSpec, restartRequired: boolean) {
  const required: string[] = []
  if (route.enabled && route.sensitive && route.scope !== 'internal') {
    required.push(`PUBLISH_${route.serviceKey.toUpperCase().replaceAll(/[^A-Z0-9]/g, '_')}`)
  }
  if (restartRequired) {
    required.push('RESTART_SINGLETON_TRAEFIK')
  }
  return required
}

export function credentialRemovalConfirmation(id: string, version: number) {
  const value = id.trim().toUpperCase().replaceAll(/[^A-Z0-9_]/g, '_')
  return `REMOVE_DNS_CREDENTIAL_${value}_V${version}`
}

export function domainRemovalConfirmation(zone: string) {
  return `REMOVE_DOMAIN_${zone.trim().toUpperCase().replaceAll(/[^A-Z0-9_]/g, '_')}`
}

export function filterOptions(values: string[]) { return [{ label: 'All', value: 'all' }, ...values.map(option)] }
export function option(value: string) { return { label: value === '' ? 'All levels' : value.replaceAll('-', ' '), value } }
export function commaValues(value: string) { return value.split(',').map((item) => item.trim()).filter(Boolean) }
export function unique(values: string[]) { return [...new Set(values)].sort() }
export function roleVariant(role: ServiceRouteRole): BadgeVariant { return role === 'routed' ? 'success' : role === 'needs-configuration' ? 'warning' : role === 'platform-exception' ? 'info' : 'neutral' }
export function statusVariant(status: string): BadgeVariant { return status === 'active' ? 'success' : status === 'drift' || status === 'service-missing' ? 'danger' : status === 'desired' ? 'info' : 'neutral' }
export function queuedToast(toast: Toast, command: Command, label: string) { toast({ message: `${label} queued (${command.id.slice(0, 12)})`, tone: 'success' }) }

export function commandFailed(command: Command) {
  return command.state === 'failed' || command.state === 'needs_attention' || command.state === 'superseded' || command.state === 'cancelled'
}
