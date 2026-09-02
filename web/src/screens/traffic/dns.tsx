import { useEffect, useState } from 'react'
import {
  Badge,
  Banner,
  Body,
  Button,
  Columns,
  EmptyState,
  Inline,
  Input,
  Mono,
  Panel,
  Select,
  Stack as Rows,
  Switch,
  useToast,
} from '@nim.zone/ui'
import { api } from '../../data/api'
import type {
  DNSPropagationStatus,
  DNSRecordPreview,
  DNSRecordSpec,
  DomainSpec,
  RouteProtocol,
  RoutingState,
  TraefikSettings,
} from '../../data/types'
import { messageOf } from '../../lib/errors'
import {
  cloneSettings,
  credentialRemovalConfirmation,
  domainRemovalConfirmation,
  emptyDNSRecord,
  option,
  latestCredentialVersions,
  providerForCredential,
  queuedToast,
  removableCredentialVersions,
  updateResolver,
} from './lib'

type Toast = ReturnType<typeof useToast>

export function DNSSettingsTab({ onQueued, scope, state, toast }: { onQueued: () => void; scope: 'dns' | 'gateway'; state: RoutingState; toast: Toast }) {
  const [settings, setSettings] = useState<TraefikSettings>(cloneSettings(state.settings))
  const [settingsConfirmation, setSettingsConfirmation] = useState('')
  const [pending, setPending] = useState('')
  const [credentialID, setCredentialID] = useState('')
  const [credentialName, setCredentialName] = useState('')
  const [provider, setProvider] = useState<'cloudflare' | 'arvan'>('cloudflare')
  const [credentialAccountID, setCredentialAccountID] = useState('')
  const [credentialEmail, setCredentialEmail] = useState('')
  const [credentialValue, setCredentialValue] = useState('')
  const latestCredentials = latestCredentialVersions(state.credentials)
  const credentialIdentityValid = provider !== 'cloudflare' || (/^([0-9a-f]{32})?$/.test(credentialAccountID.trim().toLowerCase()) && (credentialEmail.trim() === '' || credentialEmail.trim().includes('@')))
  const [protocol, setProtocol] = useState<RouteProtocol>('http')
  const [record, setRecord] = useState<DNSRecordSpec>(() => emptyDNSRecord(latestCredentials[0]?.id ?? ''))
  const [preview, setPreview] = useState<DNSRecordPreview | null>(null)
  const [propagation, setPropagation] = useState<Record<string, DNSPropagationStatus>>({})
  const [deleteRecordConfirmation, setDeleteRecordConfirmation] = useState('')
  const [deleteRecordID, setDeleteRecordID] = useState('')
  const [deleteCredentialConfirmation, setDeleteCredentialConfirmation] = useState('')
  const [deleteCredentialID, setDeleteCredentialID] = useState('')
  const [deleteCredentialVersion, setDeleteCredentialVersion] = useState(0)
  const [domainZone, setDomainZone] = useState('')
  const [domainNote, setDomainNote] = useState('')
  const [removeDomainZone, setRemoveDomainZone] = useState('')
  const [removeDomainConfirmation, setRemoveDomainConfirmation] = useState('')

  useEffect(() => setSettings(cloneSettings(state.settings)), [state.settings])

  const queueSettings = async () => {
    setPending('settings')
    try {
      const command = await api.applyTraefikSettings(settings, settingsConfirmation)
      queuedToast(toast, command, 'Static Traefik settings')
      setSettingsConfirmation('')
      onQueued()
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending('') }
  }
  const queueCredential = async () => {
    setPending('credential')
    try {
      const identity = provider === 'cloudflare' ? { accountId: credentialAccountID.trim().toLowerCase(), email: credentialEmail.trim().toLowerCase() } : {}
      const command = await api.uploadDNSCredential(credentialID, credentialName, provider, credentialValue, identity)
      queuedToast(toast, command, 'DNS credential rotation')
      setCredentialValue('')
      onQueued()
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending('') }
  }
  const queueDomain = async () => {
    setPending('domain')
    try {
      const domain: DomainSpec = { createdAt: '', note: domainNote, version: state.version, zone: domainZone }
      const command = await api.registerDomain(domain)
      queuedToast(toast, command, 'Domain acceptance')
      setDomainZone(''); setDomainNote('')
      onQueued()
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending('') }
  }
  const queueDomainRemoval = async () => {
    setPending('domain-remove')
    try {
      const command = await api.removeDomain(removeDomainZone, removeDomainConfirmation)
      queuedToast(toast, command, 'Domain withdrawal')
      setRemoveDomainZone(''); setRemoveDomainConfirmation('')
      onQueued()
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending('') }
  }
  const previewRecord = async () => {
    setPending('preview')
    try { setPreview(await api.previewDNSRecord(record, protocol)) } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }); setPreview(null) } finally { setPending('') }
  }
  const queueRecord = async () => {
    if (!preview) return
    setPending('record')
    try {
      const command = await api.applyDNSRecord(preview.record, protocol)
      queuedToast(toast, command, 'DNS record change')
      setPreview(null)
      onQueued()
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending('') }
  }
  const verify = async (id: string) => {
    setPending(`verify-${id}`)
    try {
      const value = await api.verifyDNSRecord(id)
      setPropagation((current) => ({ ...current, [id]: value }))
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending('') }
  }
  const queueDelete = async () => {
    setPending('delete')
    try {
      const command = await api.deleteDNSRecord(deleteRecordID, deleteRecordConfirmation)
      queuedToast(toast, command, 'DNS record deletion')
      setDeleteRecordID(''); setDeleteRecordConfirmation('')
      onQueued()
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending('') }
  }

  const queueCredentialDelete = async () => {
    if (!deleteCredentialID || deleteCredentialVersion === 0) return
    setPending('credential-delete')
    try {
      const command = await api.removeDNSCredentialVersion(deleteCredentialID, deleteCredentialVersion, deleteCredentialConfirmation)
      queuedToast(toast, command, 'DNS credential version removal')
      setDeleteCredentialID('')
      setDeleteCredentialVersion(0)
      setDeleteCredentialConfirmation('')
      onQueued()
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending('') }
  }

  const removableCredentials = removableCredentialVersions(state.credentials)

  return (
    <Rows>
      <Columns>
        {scope === 'gateway' ? <Panel eyebrow="Gateway listening and certificate policy" title="Ports & certificate resolvers">
          <Rows>
            <Input label="ACME account email" onChange={(event) => setSettings({ ...settings, acmeEmail: event.target.value })} type="email" value={settings.acmeEmail} />
            <Input autoCapitalize="none" hint="Public hostname only; SwarmOps derives the HTTPS dashboard URL." label="Dashboard hostname" onChange={(event) => setSettings({ ...settings, dashboardHost: event.target.value })} placeholder="traefik.example.com" spellCheck={false} value={settings.dashboardHost} />
            <Columns><Input label="Stream port range start" min="10000" max="19999" onChange={(event) => setSettings({ ...settings, portRange: { ...settings.portRange, start: Number(event.target.value) } })} type="number" value={settings.portRange.start} /><Input label="Stream port range end" min="10000" max="19999" onChange={(event) => setSettings({ ...settings, portRange: { ...settings.portRange, end: Number(event.target.value) } })} type="number" value={settings.portRange.end} /></Columns>
            <Rows gap="tight">{settings.entryPoints.map((entry) => <Inline key={entry.name}><Mono>{entry.name}</Mono><Badge>{entry.protocol.toUpperCase()} {entry.port}</Badge><Badge variant={entry.public ? 'warning' : 'info'}>{entry.public ? 'published' : 'internal'}</Badge></Inline>)}</Rows>
            <Body size="sm">HTTP/HTTPS share 80 and 443. Internal HTTP and metrics are not published. New TCP/UDP entrypoints are added by a validated route plan and reserve only ports 10000–19999.</Body>
            <Rows gap="tight">{settings.resolvers.map((resolver, index) => <Columns key={resolver.name}><Input label="Resolver name" onChange={(event) => updateResolver(setSettings, index, { name: event.target.value })} value={resolver.name} /><Select label="Challenge" onChange={(event) => updateResolver(setSettings, index, { challenge: event.target.value as typeof resolver.challenge })} options={['dns-01', 'http-01', 'tls-alpn-01'].map(option)} value={resolver.challenge} /><Select disabled={resolver.challenge !== 'dns-01'} label="DNS provider" onChange={(event) => updateResolver(setSettings, index, { provider: event.target.value as 'cloudflare' | 'arvan' })} options={[{ label: 'Cloudflare', value: 'cloudflare' }, { label: 'ArvanCloud', value: 'arvan' }]} value={resolver.provider ?? 'cloudflare'} /><Select disabled={resolver.challenge !== 'dns-01'} label="Credential" onChange={(event) => updateResolver(setSettings, index, { dnsCredentialId: event.target.value })} options={latestCredentials.filter((item) => !resolver.provider || item.provider === resolver.provider).map((item) => ({ label: `${item.name} · v${item.version}`, value: item.id }))} placeholder="Latest provider credential" value={resolver.dnsCredentialId ?? ''} /></Columns>)}</Rows>
            <Banner title="Static change restarts the singleton" tone="warning">Access-log state, operational level, resolver definitions, entrypoints, and the port range are rendered into an immutable versioned Swarm config.</Banner>
            <Input hint="Type RESTART_SINGLETON_TRAEFIK." label="Settings confirmation" onChange={(event) => setSettingsConfirmation(event.target.value)} value={settingsConfirmation} />
            <Button disabled={Boolean(pending) || settingsConfirmation !== 'RESTART_SINGLETON_TRAEFIK'} loading={pending === 'settings'} onClick={() => void queueSettings()} variant="danger">Queue static settings</Button>
          </Rows>
        </Panel> : null}
        {scope === 'dns' ? <Panel eyebrow="Cloudflare and ArvanCloud" title="DNS providers & credentials">
          <Rows>
            <Banner tone="info">The value is written first to the encrypted durable command artifact, validated with the provider, sealed in controller state, then created as a new immutable Swarm secret. Responses, logs, commands, and audit records contain metadata only.</Banner>
            <Select label="Provider" onChange={(event) => setProvider(event.target.value as 'cloudflare' | 'arvan')} options={[{ label: 'Cloudflare API token or Global API Key', value: 'cloudflare' }, { label: 'ArvanCloud DNS API key', value: 'arvan' }]} value={provider} />
            <Input label="Credential ID" onChange={(event) => setCredentialID(event.target.value)} placeholder="production-dns" value={credentialID} />
            <Input label="Display name" onChange={(event) => setCredentialName(event.target.value)} placeholder="Production DNS" value={credentialName} />
            {provider === 'cloudflare' ? <Columns><Input hint="Optional. 32 hex characters from the Cloudflare dashboard; it scopes the zone lookup when the credential spans several accounts." label="Account ID" onChange={(event) => setCredentialAccountID(event.target.value)} placeholder="Optional" value={credentialAccountID} /><Input hint="Optional. Leave empty for a scoped API token. Fill it only for a legacy Global API Key, which is sent with this email." label="Account email" onChange={(event) => setCredentialEmail(event.target.value)} placeholder="Optional" value={credentialEmail} /></Columns> : null}
            <Input autoComplete="new-password" hint={provider === 'cloudflare' ? (credentialEmail.trim() ? 'Paste the Global API Key for the account email above.' : 'Use a token scoped to DNS read/write for the required zones.') : 'Paste the Arvan API key; an optional Apikey prefix is accepted.'} label="Credential value" onChange={(event) => setCredentialValue(event.target.value)} type="password" value={credentialValue} />
            <Button disabled={Boolean(pending) || !credentialID || !credentialName || credentialValue.length < 16 || !credentialIdentityValid} loading={pending === 'credential'} onClick={() => void queueCredential()} variant="accent">Validate & rotate credential</Button>
            <Rows gap="tight">{state.credentials.length ? state.credentials.map((credential) => <Inline key={`${credential.id}-${credential.version}`}><Mono>{credential.id}</Mono><Badge>{credential.provider}</Badge>{credential.email ? <Badge>global key · {credential.email}</Badge> : null}{credential.accountId ? <Badge>account {credential.accountId.slice(0, 8)}</Badge> : null}<Badge variant={credential.state === 'validated' ? 'success' : credential.state === 'removed' ? 'neutral' : 'warning'}>v{credential.version} · {credential.state}</Badge></Inline>) : <Body size="sm">No provider credential metadata is stored yet.</Body>}</Rows>
            <Panel eyebrow="Rotate history" title="Removable old versions">
              {removableCredentials.length ? removableCredentials.map((credential) => <Inline key={`${credential.id}-${credential.version}`}><Mono>{credential.id}</Mono><Badge>{credential.provider}</Badge><Badge variant="warning">v{credential.version}</Badge><Button disabled={Boolean(pending)} size="sm" onClick={() => { setDeleteCredentialID(credential.id); setDeleteCredentialVersion(credential.version); setDeleteCredentialConfirmation('') }}>Prepare removal</Button></Inline>) : <Body size="sm">No removable older versions.</Body>}
              {deleteCredentialID ? <Rows><Banner title="Removing old immutable versions" tone="warning"><Mono>Removing a credential version cannot be undone.</Mono></Banner><Input hint={`Type ${credentialRemovalConfirmation(deleteCredentialID, deleteCredentialVersion)}.`} label="Removal confirmation" onChange={(event) => setDeleteCredentialConfirmation(event.target.value)} value={deleteCredentialConfirmation} /><Inline><Button disabled={Boolean(pending) || deleteCredentialConfirmation !== credentialRemovalConfirmation(deleteCredentialID, deleteCredentialVersion)} loading={pending === 'credential-delete'} onClick={() => void queueCredentialDelete()} variant="danger">Queue credential version removal</Button><Button disabled={Boolean(pending)} onClick={() => { setDeleteCredentialID(''); setDeleteCredentialVersion(0); setDeleteCredentialConfirmation('') }} variant="ghost">Cancel</Button></Inline></Rows> : null}
            </Panel>
          </Rows>
        </Panel> : null}
      </Columns>
      {scope === 'dns' ? <Columns>
        <Panel eyebrow="First step of publication" title="Accepted domains">
          <Rows>
            <Banner tone="info">A zone is accepted here before anything is published under it. Records may only be created inside an accepted domain, and a route may only claim a hostname that already exists as a record — an unaccepted domain gets no record, no route, and no public exposure.</Banner>
            <Columns><Input autoCapitalize="none" label="Apex zone" onChange={(event) => setDomainZone(event.target.value)} placeholder="example.com" spellCheck={false} value={domainZone} /><Input label="Note" onChange={(event) => setDomainNote(event.target.value)} placeholder="Who owns this zone" value={domainNote} /></Columns>
            <Button disabled={Boolean(pending) || !domainZone.includes('.')} loading={pending === 'domain'} onClick={() => void queueDomain()} variant="accent">Accept domain</Button>
            <Rows gap="tight">{state.domains.length ? state.domains.map((domain) => <Inline key={domain.zone}><Mono>{domain.zone}</Mono><Badge variant="success">accepted</Badge><Body size="sm">{domain.note}</Body><Button disabled={Boolean(pending)} onClick={() => { setRemoveDomainZone(domain.zone); setRemoveDomainConfirmation('') }} size="sm" variant="ghost">Prepare withdrawal</Button></Inline>) : <EmptyState description="Accept the apex zone this gateway is allowed to publish under before creating any subdomain." icon="globe" title="No accepted domains" />}</Rows>
            {removeDomainZone ? <Rows><Banner title="Withdrawal is refused while dependents exist" tone="warning">Every record and route under {removeDomainZone} must be removed first.</Banner><Input hint={`Type ${domainRemovalConfirmation(removeDomainZone)}.`} label="Withdrawal confirmation" onChange={(event) => setRemoveDomainConfirmation(event.target.value)} value={removeDomainConfirmation} /><Inline><Button disabled={Boolean(pending) || removeDomainConfirmation !== domainRemovalConfirmation(removeDomainZone)} loading={pending === 'domain-remove'} onClick={() => void queueDomainRemoval()} variant="danger">Queue domain withdrawal</Button><Button disabled={Boolean(pending)} onClick={() => setRemoveDomainZone('')} variant="ghost">Cancel</Button></Inline></Rows> : null}
          </Rows>
        </Panel>
        <Panel eyebrow="Read before write" title="DNS record preview">
          <Rows>
            <Columns><Input label="Record ID" onChange={(event) => setRecord({ ...record, id: event.target.value })} value={record.id} /><Select label="Route protocol" onChange={(event) => { const next = event.target.value as RouteProtocol; setProtocol(next); if (next !== 'http') setRecord({ ...record, proxied: false }) }} options={['http', 'tcp', 'udp'].map(option)} value={protocol} /></Columns>
            <Columns><Select hint="Only accepted domains can hold a record." label="Zone" onChange={(event) => setRecord({ ...record, zone: event.target.value })} options={state.domains.map((domain) => ({ label: domain.zone, value: domain.zone }))} placeholder="Accept a domain first" value={record.zone} /><Input label="Record name" onChange={(event) => setRecord({ ...record, name: event.target.value })} placeholder="app.example.com" value={record.name} /></Columns>
            <Columns><Select label="Type" onChange={(event) => setRecord({ ...record, type: event.target.value as DNSRecordSpec['type'] })} options={['A', 'AAAA', 'CNAME'].map(option)} value={record.type} /><Input label="Content" onChange={(event) => setRecord({ ...record, content: event.target.value })} placeholder="203.0.113.10" value={record.content} /><Input label="TTL seconds" min="60" max="86400" onChange={(event) => setRecord({ ...record, ttl: Number(event.target.value) })} type="number" value={record.ttl} /></Columns>
            <Select label="Provider credential" onChange={(event) => setRecord({ ...record, credentialId: event.target.value })} options={latestCredentials.map((credential) => ({ label: `${credential.name} · ${credential.provider} v${credential.version}`, value: credential.id }))} placeholder="Select credential" value={record.credentialId} />
            <Columns><Switch checked={record.adopted} description="Required before SwarmOps may change a matching provider record it did not create." onChange={(event) => setRecord({ ...record, adopted: event.target.checked, managed: !event.target.checked })}>Adopt existing record</Switch><Switch checked={record.proxied} disabled={protocol !== 'http' || providerForCredential(latestCredentials, record.credentialId) !== 'cloudflare'} description="Raw TCP/UDP records are always DNS-only." onChange={(event) => setRecord({ ...record, proxied: event.target.checked })}>Cloudflare proxy</Switch></Columns>
            <Button disabled={Boolean(pending)} loading={pending === 'preview'} onClick={() => void previewRecord()} variant="secondary">Read provider & preview</Button>
            {preview ? <Banner title={`${preview.action.toUpperCase()} preview`} tone={preview.action === 'noop' ? 'info' : 'warning'}>{preview.existing ? `Provider record ${preview.existing.providerRecordId} was read before this change.` : 'No matching provider record exists.'} {preview.warnings.join(' ')}</Banner> : null}
            {preview ? <Button disabled={Boolean(pending)} loading={pending === 'record'} onClick={() => void queueRecord()} variant="accent">Queue reviewed DNS change</Button> : null}
          </Rows>
        </Panel>
        <Panel eyebrow="Authoritative + public resolvers" title="Owned records & propagation">
          <Rows>
            {state.dnsRecords.length ? state.dnsRecords.map((item) => <Rows gap="tight" key={item.id}><Inline><Mono>{item.name}</Mono><Badge>{item.type}</Badge><Badge variant={item.managed ? 'success' : 'info'}>{item.managed ? 'created' : 'adopted'}</Badge></Inline><Body size="sm">{item.content} · TTL {item.ttl} · {item.proxied ? 'proxied' : 'DNS-only'}</Body><Inline><Button disabled={Boolean(pending)} loading={pending === `verify-${item.id}`} onClick={() => void verify(item.id)} size="sm" variant="secondary">Verify propagation</Button><Button disabled={Boolean(pending)} onClick={() => { setDeleteRecordID(item.id); setDeleteRecordConfirmation('') }} size="sm" variant="ghost">Prepare deletion</Button></Inline>{propagation[item.id] ? <Propagation status={propagation[item.id]} /> : null}</Rows>) : <EmptyState description="Create or explicitly adopt A, AAAA, or CNAME records. Disabling a route never deletes DNS." icon="globe" title="No owned DNS records" />}
            {deleteRecordID ? <Rows><Banner title="Separate DNS deletion" tone="warning">A route must release this record first. Cutover rollback and route disable never delete it.</Banner><Input hint={`Type DELETE_DNS_RECORD_${deleteRecordID.toUpperCase().replaceAll('-', '_')}.`} label="Deletion confirmation" onChange={(event) => setDeleteRecordConfirmation(event.target.value)} value={deleteRecordConfirmation} /><Inline><Button disabled={Boolean(pending) || deleteRecordConfirmation !== `DELETE_DNS_RECORD_${deleteRecordID.toUpperCase().replaceAll('-', '_')}`} loading={pending === 'delete'} onClick={() => void queueDelete()} variant="danger">Queue record deletion</Button><Button disabled={Boolean(pending)} onClick={() => setDeleteRecordID('')} variant="ghost">Cancel</Button></Inline></Rows> : null}
          </Rows>
        </Panel>
      </Columns> : null}
    </Rows>
  )
}

export function Propagation({ status }: { status: DNSPropagationStatus }) {
  return <Rows gap="tight"><Badge dot variant={status.ready ? 'success' : 'warning'}>{status.ready ? 'Ready on all resolvers' : 'Propagation incomplete'}</Badge>{status.checks.map((check) => <Body key={check.resolver} size="sm"><Mono>{check.resolver}</Mono> · {check.valid ? check.answers.join(', ') : check.error || 'No matching answer'}</Body>)}</Rows>
}
