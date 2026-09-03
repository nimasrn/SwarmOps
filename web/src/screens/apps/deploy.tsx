import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Badge,
  BrandMark,
  Banner,
  Button,
  Columns,
  DataTable,
  DetailLayout,
  EmptyState,
  Facts,
  Icon,
  Inline,
  Input,
  Mono,
  Panel,
  Select,
  Spinner,
  Segmented,
  StageTrack,
  Stack as Rows,
  Body,
  useToast,
} from '@nim.zone/ui'
import type { Stage } from '@nim.zone/ui'
import { api } from '../../data/api'
import type {
  ApplicationSpec,
  ApprovedWorkload,
  PlatformDefinition,
  SourceConnection,
  SourcePlan,
  SourceProviderKind,
  SourceRepository,
  SourceStatus,
} from '../../data/types'
import { formatDateTime, shortID } from '../../lib/format'
import { messageOf } from '../../lib/errors'
import { Screen } from '../../components/screen'
import { ConfirmPhrase } from '../../components/confirm-phrase'
import { DeploymentPlan } from './deploy-parts/plan'
import { SourceSetupPanel } from './deploy-parts/setup'
import { SOURCE_DOCS_URL } from './source-settings'
import { KubernetesImportPanel } from './kubernetes-import'
import {
  DiscoveryEvidence,
  connectionColumns,
  defaultConnectionName,
  deploymentBlocks,
  draftKey,
  maskedToken,
  normalizeArray,
  providerBaseURLHint,
  providerBaseURLPlaceholder,
  providerBrand,
  providerLabel,
  providerOrigin,
  removalPhrase,
  selectSlot,
  sourceDomainPolicy,
  sourceLocation,
  sourceServiceKey,
  telemetryStacks,
  dynamicDomainHint,
  DOMAIN_FIELD_ID,
  type SourceDraft,
} from './deploy-parts/parts'

interface DeployPageProps {
  managerID: string
  managerName?: string
  /** Where the push registry is configured, now that it is not part of the
      source boundary. */
  onOpenImages?: () => void
  /** Where the Kubernetes reader hands its generated Compose off to. */
  onOpenWorkloads?: () => void
  toast: ReturnType<typeof useToast>
}

/**
 * Where a deployment can START.
 *
 * These are four ways into ONE flow, not four products. Reading Kubernetes
 * manifests used to be its own destination in its own area, which made a way
 * of starting a deployment look like a different thing you could do — and left
 * an operator who had manifests with no reason to think Deploy was for them.
 */
type DeploySource = 'kubernetes' | 'repository'

const DEPLOY_SOURCES: { hint: string; label: string; value: DeploySource }[] = [
  { hint: 'Connect a Git provider and build a pinned revision', label: 'Git repository', value: 'repository' },
  { hint: 'Read manifests and see what Swarm can run, and what it cannot', label: 'Kubernetes manifests', value: 'kubernetes' },
]
const PROVIDERS: { label: string; value: SourceProviderKind }[] = [
  { label: 'GitHub or GitHub Enterprise', value: 'github' },
  { label: 'GitLab or self-managed GitLab', value: 'gitlab' },
  { label: 'Gitea or Forgejo', value: 'gitea' },
]

export function DeployPage({ managerID, managerName, onOpenImages, onOpenWorkloads, toast }: DeployPageProps) {
  const [source, setSource] = useState<DeploySource>('repository')
  const [status, setStatus] = useState<SourceStatus | null>(null)
  const [connections, setConnections] = useState<SourceConnection[]>([])
  const [repositories, setRepositories] = useState<SourceRepository[]>([])
  const [approved, setApproved] = useState<ApprovedWorkload[]>([])
  const [platform, setPlatform] = useState<PlatformDefinition | null>(null)
  const [plan, setPlan] = useState<SourcePlan | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState('')

  const [provider, setProvider] = useState<SourceProviderKind>('github')
  const [connectionName, setConnectionName] = useState('GitHub source')
  const [baseURL, setBaseURL] = useState('')
  const [token, setToken] = useState('')
  const [editingConnectionID, setEditingConnectionID] = useState('')
  const [removingConnectionID, setRemovingConnectionID] = useState('')

  const [connectionID, setConnectionID] = useState('')
  const [repositoryID, setRepositoryID] = useState('')
  const [ref, setRef] = useState('')
  const [serviceKey, setServiceKey] = useState('')
  const [slotName, setSlotName] = useState('')
  const [domain, setDomain] = useState('')
  const [port, setPort] = useState('8080')
  const [healthPath, setHealthPath] = useState('/healthz')
  const [metricsEnabled, setMetricsEnabled] = useState(false)
  // An install with no manifest has no slot list to pick from, so the operator
  // states the ceiling this deployment should run under instead of inheriting
  // a reviewed one. These are ignored entirely when slots exist.
  const [freeReplicas, setFreeReplicas] = useState('1')
  const [freeCPU, setFreeCPU] = useState('0.5')
  const [freeMemory, setFreeMemory] = useState('512')
  const [freeResolver, setFreeResolver] = useState('le')
  const [draftSavedAt, setDraftSavedAt] = useState('')
  const [managing, setManaging] = useState(false)
  const [changingRepository, setChangingRepository] = useState(false)
  // A restored draft has to outlive the repository listing that follows it.
  const restoredDraft = useRef<SourceDraft | null>(null)
  const [hydrated, setHydrated] = useState(false)

  const selectedConnection = connections.find((connection) => connection.id === connectionID)
  const selectedRepository = repositories.find((repository) => repository.id === repositoryID)
  const deployableServices = useMemo(
    () => (plan?.services ?? []).filter((service) => service.classification === 'application'),
    [plan],
  )
  const selectedService = useMemo(
    () => deployableServices.find((service) => sourceServiceKey(service) === serviceKey),
    [deployableServices, serviceKey],
  )
  const unmanaged = Boolean(platform?.unmanaged)
  // A repository nobody has deployed yet has no slot, and sending the operator
  // away to author one before the first deployment is refused reviewed
  // nothing. The controller declares the slot from what is chosen here, so the
  // name is free-form wherever this controller owns its own definition.
  const slotCreatable = unmanaged || Boolean(platform?.editable && platform?.mode === 'manifest')
  const reviewedSlot = approved.find((slot) => slot.name === slotName)
  // Downstream, a slot is a slot: the review card, the blockers, and the
  // deployment all read the same shape whether a manifest approved it or the
  // operator just typed it.
  const selectedSlot = reviewedSlot ?? (slotCreatable && slotName.trim()
    ? {
      cpuCores: Number(freeCPU) || 0.25,
      domainOptional: true,
      memoryMiB: Number(freeMemory) || 256,
      name: slotName.trim(),
      replicas: Number(freeReplicas) || 1,
      resolver: freeResolver.trim(),
    } satisfies ApprovedWorkload
    : undefined)
  // The slot this deployment will bring into existence, as opposed to one a
  // manifest already reviewed: it is the operator who states its ceiling.
  const newSlot = Boolean(selectedSlot && !reviewedSlot)
  const selectedServiceFindings = selectedService?.findings ?? []
  const blockers = selectedServiceFindings.filter((finding) => finding.level === 'blocker')
  const canEditDomain = newSlot || Boolean(selectedSlot?.domainOptional || selectedSlot?.domainSuffixes?.length)

  const loadSource = useCallback(async () => {
    setError('')
    const nextStatus = await api.sourceStatus()
    setStatus(nextStatus)
    if (!nextStatus.enabled) {
      setConnections([])
      return
    }
    const nextConnections = normalizeArray(await api.sourceConnections())
    setConnections(nextConnections)
    setConnectionID((current) => nextConnections.some((connection) => connection.id === current) ? current : nextConnections[0]?.id ?? '')
  }, [])

  // `preferred` is how a restored draft survives this load: listing a
  // connection's projects used to reset the selection to the first row, which
  // threw away the repository and revision the operator had saved.
  const loadRepositories = useCallback(async (id: string, preferred?: { ref: string; repositoryID: string }) => {
    if (!id) {
      setRepositories([])
      return
    }
    setPending('repositories')
    setError('')
    try {
      const nextRepositories = normalizeArray(await api.sourceRepositories(id))
      setRepositories(nextRepositories)
      const restored = preferred ? nextRepositories.find((repository) => repository.id === preferred.repositoryID) : undefined
      const nextRepository = restored ?? nextRepositories[0]
      setRepositoryID(nextRepository?.id ?? '')
      setRef(restored && preferred ? (preferred.ref || restored.defaultBranch || '') : nextRepository?.defaultBranch ?? '')
    } catch (reason) {
      setRepositories([])
      setRepositoryID('')
      setError(messageOf(reason))
    } finally {
      setPending('')
    }
  }, [])

  const loadApprovedSlots = useCallback(async () => {
    if (!managerID) {
      setApproved([])
      setPlatform(null)
      return
    }
    try {
      const [slots, definition] = await Promise.all([api.approvedApplications(), api.platform()])
      setApproved(normalizeArray(slots))
      setPlatform(definition)
      // A new slot has to name a resolver the definition actually declares, so
      // the field starts on one instead of on a guess the operator would only
      // find out was wrong when the deployment was refused.
      const declared = normalizeArray(definition?.manifest?.dns?.resolvers)[0]?.name
      if (declared) setFreeResolver(declared)
    } catch (reason) {
      setApproved([])
      setPlatform(null)
      setError(messageOf(reason))
    }
  }, [managerID])

  useEffect(() => { void loadSource().catch((reason) => setError(messageOf(reason))) }, [loadSource])
  useEffect(() => { void loadApprovedSlots() }, [loadApprovedSlots])
  useEffect(() => {
    setSlotName('')
    setDomain('')
  }, [managerID])
  useEffect(() => {
    if (!status?.enabled || !connectionID) {
      setRepositories([])
      return
    }
    setPlan(null)
    // A restored draft is consumed once: after this load the operator's own
    // choices own the selection.
    const draft = restoredDraft.current
    restoredDraft.current = null
    if (!draft || draft.connectionID !== connectionID) setServiceKey('')
    void loadRepositories(connectionID, draft && draft.connectionID === connectionID ? { ref: draft.ref, repositoryID: draft.repositoryID } : undefined)
  }, [connectionID, loadRepositories, status?.enabled])
  // The service names itself. A reviewed slot of the same name is what it maps
  // to; otherwise the deployment proposes a new slot under that name rather
  // than silently landing in whichever slot happens to sort first.
  useEffect(() => {
    if (!selectedService || slotName) return
    const matching = approved.find((slot) => slot.name === selectedService.name)
    if (matching) {
      selectSlot(matching.name, approved, setSlotName, setDomain, selectedService.route?.hosts?.[0])
      return
    }
    if (!slotCreatable) return
    setSlotName(selectedService.name)
    setDomain(selectedService.route?.hosts?.[0] ?? '')
  }, [approved, selectedService, slotCreatable, slotName])

  const chooseProvider = (next: SourceProviderKind) => {
    setProvider(next)
    setBaseURL('')
    setConnectionName(defaultConnectionName(next))
  }

  const chooseConnection = (next: string) => {
    setConnectionID(next)
    setRepositoryID('')
    setRef('')
    setPlan(null)
    setServiceKey('')
    setSlotName('')
  }

  const chooseRepository = (next: string) => {
    const repository = repositories.find((candidate) => candidate.id === next)
    setRepositoryID(next)
    setRef(repository?.defaultBranch ?? '')
    setPlan(null)
    setServiceKey('')
    setSlotName('')
  }

  const beginConnectionEdit = (connection: SourceConnection) => {
    setEditingConnectionID(connection.id)
    setProvider(connection.kind)
    setConnectionName(connection.name)
    setBaseURL(connection.baseUrl)
    setToken('')
    setRemovingConnectionID('')
  }

  const saveConnection = async () => {
    if (!token.trim()) return
    setPending('connection')
    setError('')
    let credential = token
    setToken('')
    try {
      const input = { baseUrl: baseURL, kind: provider, name: connectionName, token: credential }
      const saved = editingConnectionID
        ? await api.updateSourceConnection(editingConnectionID, input)
        : await api.createSourceConnection(input)
      credential = ''
      setEditingConnectionID('')
      setConnections((current) => {
        const next = editingConnectionID
          ? current.map((connection) => connection.id === saved.id ? saved : connection)
          : [...current, saved]
        return [...next].sort((left, right) => left.name.localeCompare(right.name))
      })
      chooseConnection(saved.id)
      setManaging(false)
      toast({ message: `${saved.name} was verified and sealed`, tone: 'success' })
    } catch (reason) {
      setError(messageOf(reason))
    } finally {
      credential = ''
      setPending('')
    }
  }

  const removeConnection = async (phrase: string) => {
    const connection = connections.find((candidate) => candidate.id === removingConnectionID)
    // The phrase is passed in rather than read from state: a setState in the
    // same tick has not landed yet, and reading it here would refuse the very
    // confirmation the operator just typed.
    if (!connection || phrase !== removalPhrase(connection)) return
    setPending('connection-remove')
    setError('')
    try {
      await api.removeSourceConnection(connection.id)
      setConnections((current) => current.filter((candidate) => candidate.id !== connection.id))
      if (connectionID === connection.id) chooseConnection('')
      setRemovingConnectionID('')
      toast({ message: `${connection.name} was removed`, tone: 'success' })
    } catch (reason) {
      setError(messageOf(reason))
    } finally {
      setPending('')
    }
  }

  const discover = async () => {
    if (!connectionID || !repositoryID) return
    setPending('discover')
    setError('')
    try {
      const nextPlan = await api.discoverSource({ connectionId: connectionID, ref: ref.trim(), repositoryId: repositoryID })
      setPlan(nextPlan)
      const first = nextPlan.services.find((service) => service.classification === 'application')
      setServiceKey(first ? sourceServiceKey(first) : '')
      setSlotName('')
      if (first) {
        setPort(String(first.port || 8080))
        setHealthPath(first.healthPath || '/healthz')
        setMetricsEnabled(Boolean(first.metrics))
      }
      toast({ message: `Discovery pinned ${shortID(nextPlan.revision.sha)}`, tone: 'success' })
    } catch (reason) {
      setPlan(null)
      setServiceKey('')
      setError(messageOf(reason))
    } finally {
      setPending('')
    }
  }

  const chooseService = (nextKey: string) => {
    const service = deployableServices.find((candidate) => sourceServiceKey(candidate) === nextKey)
    setServiceKey(nextKey)
    setSlotName('')
    if (service) {
      setPort(String(service.route?.targetPort || service.port || 8080))
      setHealthPath(service.healthPath || '/healthz')
      setMetricsEnabled(Boolean(service.metrics))
    }
  }

  const chooseSlotName = (next: string) => selectSlot(next, approved, setSlotName, setDomain, selectedService?.route?.hosts?.[0])

  // A draft is the selection, never the evidence: no path, digest, finding, or
  // provider response is written to browser storage, so a saved draft cannot
  // become a copy of someone's repository sitting in localStorage.
  const writeDraft = useCallback(() => {
    if (!managerID) return false
    const draft: SourceDraft = { connectionID, domain, healthPath, managerID, metricsEnabled, port, ref, repositoryID, savedAt: new Date().toISOString(), serviceKey, slotName, source }
    try {
      window.localStorage.setItem(draftKey(managerID), JSON.stringify(draft))
      setDraftSavedAt(draft.savedAt)
      return true
    } catch {
      return false
    }
  }, [connectionID, domain, healthPath, managerID, metricsEnabled, port, ref, repositoryID, serviceKey, slotName, source])

  const saveDraft = () => {
    if (!managerID) return
    toast(writeDraft()
      ? { message: 'Deployment plan draft saved in this browser', tone: 'success' }
      : { message: 'This browser refused to store the draft', tone: 'danger' })
  }

  // The draft is kept without being asked for. A reload used to cost the
  // operator the whole selection — which way in, which provider, which
  // repository, which revision — even though none of it is evidence.
  useEffect(() => {
    if (!hydrated) return
    writeDraft()
  }, [hydrated, writeDraft])

  const restoreDraft = useCallback(() => {
    if (!managerID) return
    let stored: string | null = null
    try {
      stored = window.localStorage.getItem(draftKey(managerID))
    } catch {
      setHydrated(true)
      return
    }
    if (!stored) {
      setHydrated(true)
      return
    }
    try {
      const draft = JSON.parse(stored) as SourceDraft
      restoredDraft.current = draft
      if (draft.source === 'kubernetes' || draft.source === 'repository') setSource(draft.source)
      setConnectionID(draft.connectionID)
      setRepositoryID(draft.repositoryID)
      setRef(draft.ref)
      setSlotName(draft.slotName)
      setDomain(draft.domain)
      setPort(draft.port)
      setHealthPath(draft.healthPath)
      setMetricsEnabled(draft.metricsEnabled)
      setServiceKey(draft.serviceKey)
      setDraftSavedAt(draft.savedAt)
    } catch {
      // A draft this console cannot read is a draft it discards. It holds no
      // information the operator cannot re-enter in four fields.
      restoredDraft.current = null
      window.localStorage.removeItem(draftKey(managerID))
    } finally {
      setHydrated(true)
    }
  }, [managerID])

  useEffect(() => { restoreDraft() }, [restoreDraft])

  const deploy = async () => {
    if (!plan || !selectedService || !selectedSlot || !connectionID || !repositoryID || blockers.length > 0 || !managerID) return
    setPending('deploy')
    setError('')
    try {
      const application: ApplicationSpec = {
        cpus: selectedSlot.cpuCores,
        domain: domain.trim(),
        healthPath: healthPath.trim(),
        image: '',
        memoryMiB: selectedSlot.memoryMiB,
        metrics: metricsEnabled,
        name: selectedSlot.name,
        port: Number(port),
        replicas: selectedSlot.replicas,
        resolver: domain.trim() ? selectedSlot.resolver : '',
      }
      const command = await api.deploySource({
        composePath: selectedService.composePath,
        connectionId: connectionID,
        planId: plan.id,
        repositoryId: repositoryID,
        revision: plan.revision.sha,
        service: selectedService.service,
      }, application)
      toast({ message: `${selectedSlot.name} source deployment queued (${shortID(command.id)})`, tone: 'success' })
    } catch (reason) {
      setError(messageOf(reason))
    } finally {
      setPending('')
    }
  }

  if (!status) {
    // The error has to win over the spinner. A failed capability read used to
    // leave this screen spinning forever with its own explanation rendered
    // below a branch that never ran — indistinguishable, from the outside,
    // from a slow controller.
    return error
      ? (
        <Screen page="deploy">
          <Banner title="Source deployment capability is unavailable" tone="danger">
            {error}. This is a controller read, not a provider failure: nothing about your repositories or tokens is implied by it.
          </Banner>
        </Screen>
      )
      : <Screen page="deploy"><Panel><Spinner label="Reading source deployment capability" /></Panel></Screen>
  }

  const deployBlocks = deploymentBlocks({
    managerID,
    selectedService,
    selectedSlot,
    status,
    blockers,
    slotCreatable,
  })
  const discovered = Boolean(plan)

  const stages: Stage[] = [
    { caption: 'Provider and repository', id: 'source', label: 'Source', status: repositoryID ? 'done' : 'active' },
    { caption: 'Scan complete tree', id: 'discover', label: 'Discovery', status: discovered ? 'done' : repositoryID ? 'active' : 'pending' },
    { caption: 'Map and validate', id: 'review', label: 'Review', status: blockers.length ? 'blocked' : selectedService && selectedSlot ? 'done' : discovered ? 'active' : 'pending' },
    { caption: 'Build and start first', id: 'release', label: 'Release', status: deployBlocks.length === 0 ? 'active' : 'pending' },
  ]

  /* Connecting a provider and scanning a repository need only the source
     boundary itself. Bounded builds and the registry prefix are release-time
     requirements, so they are reported here and enforced by the deployment
     blocks — not used to hide the whole flow behind a settings page. */
  const ready = status.enabled
  const releaseReady = status.buildEnabled

  return (
    <Screen
      about="SwarmOps reads a repository, classifies what it finds, builds the one service you choose, and rolls it out through the same policy as everything else. You write no Compose, no route, and no connection string."
      insights={[
        { hint: !ready ? 'Enable the source boundary on the controller' : releaseReady ? 'A repository can be scanned and deployed' : 'Connect and scan now; configure the registry before release', icon: 'play', label: 'Source deployment', tone: ready && releaseReady ? 'success' : 'warning', value: ready ? (releaseReady ? 'Ready' : 'Release setup pending') : 'Setup required' },
        { hint: connections.length ? 'Verified providers this controller may read from' : 'No provider is connected yet', icon: 'link', label: 'Providers', tone: connections.length ? 'success' : 'neutral', value: String(connections.length) },
        { hint: plan ? `${plan.services.length} service${plan.services.length === 1 ? '' : 's'} found in the scanned tree` : 'Scan a repository to see what it holds', icon: 'layers', label: 'Discovered services', unmeasured: !plan, value: String(plan?.services.length ?? 0) },
        { hint: blockers.length ? 'Each one stops the deployment until it is resolved' : 'Nothing currently blocks a deployment', icon: 'alert', label: 'Blockers', tone: blockers.length ? 'danger' : 'success', value: String(blockers.length) },
      ]}
      page="deploy"
      width="full"
    >
      {error ? <Banner title="Source deployment needs attention" tone="danger">{error}</Banner> : null}

      {/* One flow, several ways in. */}
      <Segmented
        label="Where this deployment starts"
        onChange={(value: string) => setSource(value as DeploySource)}
        options={DEPLOY_SOURCES.map((entry) => ({ label: entry.label, value: entry.value }))}
        value={source}
      />

      {source === 'kubernetes' ? (
        <KubernetesImportPanel onOpenWorkloads={onOpenWorkloads ?? (() => undefined)} />
      ) : !ready ? (
        <>
        <SourceSetupPanel onApplied={() => void loadSource()} status={status} />
        </>
      ) : (
        <>
          {!releaseReady ? (
            <Banner
              action={<Inline>{onOpenImages ? <Button onClick={onOpenImages} size="sm" variant="accent">Open registry settings</Button> : null}<Button href={SOURCE_DOCS_URL} rel="noreferrer" size="sm" target="_blank" variant="ghost">Setup guide</Button></Inline>}
              title="Provider and repository steps are open; release is not"
              tone="warning"
            >
              You can connect a provider, list projects, and scan a repository now. Building an image from that source needs a registry namespace, a sealed push credential, and bounded builds — a separate boundary, set under Apps → Images &amp; registries. A service that ships an already-pinned image deploys without them.
            </Banner>
          ) : null}
          <StageTrack label="Source deployment stages" stages={stages} />

          <DetailLayout
            aside={
              <DeploymentPlan
                approved={approved}
                draftSavedAt={draftSavedAt}
                onSaveDraft={saveDraft}
                plan={plan}
                blocks={deployBlocks}
                domain={domain}
                findings={[...(plan?.findings ?? []), ...selectedServiceFindings]}
                metrics={metricsEnabled}
                onChooseSlot={chooseSlotName}
                onDeploy={() => void deploy()}
                onToggleMetrics={setMetricsEnabled}
                pending={pending}
                selectedService={selectedService}
                selectedSlot={selectedSlot}
                slotCreatable={slotCreatable}
                slotName={slotName}
              />
            }
          >
            {/* 1 — Provider. A verified connection reads as a record; the form
                only returns when there is something to add or replace. */}
            <Panel
              actions={selectedConnection && !managing && !editingConnectionID ? <Button onClick={() => setManaging(true)} size="sm" variant="secondary">Change…</Button> : null}
              marker="1"
              title="Provider"
            >
              <Rows>
                {selectedConnection && !managing && !editingConnectionID ? (
                  <Facts columns={3} items={[
                    {
                      label: 'Provider',
                      value: (
                        <Inline>
                          <BrandMark name={providerBrand(selectedConnection.kind)} size="lg" />
                          <Rows gap="tight">
                            <Inline><strong>{selectedConnection.name}</strong><Badge pill size="sm" tone="soft" variant="success">Connected</Badge></Inline>
                            <Mono>{providerOrigin(selectedConnection.baseUrl)}</Mono>
                          </Rows>
                        </Inline>
                      ),
                    },
                    {
                      label: 'Token',
                      value: (
                        <Rows gap="tight">
                          <Mono>{maskedToken(selectedConnection)}</Mono>
                          <Body size="sm" tone="muted">Sealed · never returned to this console</Body>
                        </Rows>
                      ),
                    },
                    {
                      label: 'Account',
                      value: (
                        <Rows gap="tight">
                          <Inline><Icon name="check-circle" size="xs" tone="success" />Verified</Inline>
                          <Mono>{selectedConnection.account || 'Not set'}</Mono>
                        </Rows>
                      ),
                    },
                  ]} />
                ) : (
                  <>
                    <Select label="Provider" onChange={(event) => chooseProvider(event.target.value as SourceProviderKind)} options={PROVIDERS} value={provider} />
                    <Input label="Connection name" maxLength={96} onChange={(event) => setConnectionName(event.target.value)} value={connectionName} />
                    <Input hint={providerBaseURLHint(provider)} label="Provider API base URL (optional for public provider)" onChange={(event) => setBaseURL(event.target.value)} placeholder={providerBaseURLPlaceholder(provider)} value={baseURL} />
                    <Input autoComplete="off" hint="SwarmOps verifies the account before sealing this value. It is cleared from this form immediately after submission and is never shown again." label="Read-only provider token" minLength={8} onChange={(event) => setToken(event.target.value)} required type="password" value={token} />
                    <Inline>
                      <Button disabled={pending !== '' || !connectionName.trim() || token.trim().length < 8} loading={pending === 'connection'} onClick={() => void saveConnection()} variant="accent">{editingConnectionID ? 'Verify and replace token' : 'Verify and save connection'}</Button>
                      {connections.length ? <Button disabled={pending !== ''} onClick={() => { setManaging(false); setEditingConnectionID(''); setToken(''); setConnectionName(defaultConnectionName(provider)); setBaseURL('') }} variant="ghost">Cancel</Button> : null}
                    </Inline>
                  </>
                )}
                {!plan ? <Banner icon="lock" title="Security" tone="neutral">SwarmOps never retains your source contents or access tokens. Repositories are accessed on-demand and never persisted.</Banner> : null}
              </Rows>
            </Panel>

            {/* The sealed-connection record is management, not review: it is
                shown while the operator is in the provider form, and folds
                away again once one connection is the selected source. */}
            {managing && connections.length > 0 ? (
              <Panel eyebrow="Sealed connections" title="Provider access">
                <DataTable
                  caption="Verified source provider connections"
                  columns={connectionColumns(beginConnectionEdit)}
                  empty={<EmptyState description="No provider connections are available." icon="package" title="No source connections" />}
                  rowKey={(connection) => connection.id}
                  rows={connections}
                />
                {selectedConnection ? <Inline><Button disabled={pending !== ''} onClick={() => beginConnectionEdit(selectedConnection)} size="sm" variant="secondary">Replace selected token</Button><Button disabled={pending !== ''} onClick={() => { setRemovingConnectionID(selectedConnection.id) }} size="sm" variant="ghost">Remove selected connection</Button></Inline> : null}
                {removingConnectionID ? (
                  <Rows gap="tight">
                    <ConfirmPhrase
                      action="Remove connection"
                      busy={pending === 'connection-remove'}
                      consequence="Removing a connection stops future provider access. It does not change deployed applications or their source-independent command records."
                      onConfirm={(phrase) => removeConnection(phrase)}
                      phrase={removalPhrase(connections.find((connection) => connection.id === removingConnectionID))}
                    />
                    <Button disabled={pending !== ''} onClick={() => { setRemovingConnectionID('') }} size="sm" variant="ghost">Keep connection</Button>
                  </Rows>
                ) : null}
              </Panel>
            ) : null}

            {/* Source also owns the repository and immutable revision. */}
            <Panel
              actions={
                selectedRepository && !changingRepository ? (
                  <Inline>
                    <Button disabled={pending !== ''} loading={pending === 'discover'} onClick={() => void discover()} size="sm" variant={discovered ? 'secondary' : 'accent'}>{discovered ? 'Re-scan revision' : 'Discover deployment evidence'}</Button>
                    <Button disabled={pending !== ''} onClick={() => setChangingRepository(true)} size="sm" variant="secondary">Change…</Button>
                  </Inline>
                ) : null
              }
              title="Repository"
            >
              {selectedRepository && !changingRepository ? (
                <Columns>
                  <Inline>
                    <Icon name="document" size="md" />
                    <Rows gap="tight">
                      <Inline><strong>{selectedRepository.path}</strong>{selectedRepository.private ? <Badge pill size="sm" tone="soft" variant="neutral">Private</Badge> : null}</Inline>
                      <Mono>{selectedRepository.webUrl || `${providerOrigin(selectedConnection?.baseUrl ?? '')}/${selectedRepository.path}.git`}</Mono>
                    </Rows>
                  </Inline>
                  <Facts columns={1} items={[
                    { label: plan ? 'Commit (pinned)' : 'Revision', mono: true, value: plan?.revision.sha ?? (ref || selectedRepository.defaultBranch || 'main') },
                    { label: 'Evidence generated', value: plan ? formatDateTime(plan.generatedAt) : 'Not scanned yet' },
                  ]} />
                </Columns>
              ) : (
              <Rows>
                <Columns>
                  <Rows>
                    <Select label="Verified provider connection" onChange={(event) => chooseConnection(event.target.value)} options={connections.map((connection) => ({ label: `${connection.name} · ${providerLabel(connection.kind)}`, value: connection.id }))} placeholder="Add a connection first" value={connectionID} />
                    <Select label="Private project" onChange={(event) => chooseRepository(event.target.value)} options={repositories.map((repository) => ({ label: `${repository.path}${repository.private ? ' · private' : ''}`, value: repository.id }))} placeholder={connectionID ? 'Load a project' : 'Choose a provider'} value={repositoryID} />
                    <Button disabled={pending !== '' || !connectionID} loading={pending === 'repositories'} onClick={() => void loadRepositories(connectionID)} size="sm" variant="ghost">Reload available projects</Button>
                  </Rows>
                  <Rows>
                    <Input hint={selectedRepository?.defaultBranch ? `Default branch: ${selectedRepository.defaultBranch}` : 'A branch, tag, or commit that the provider can resolve.'} label="Revision" onChange={(event) => setRef(event.target.value)} placeholder="main" value={ref} />
                    {plan ? <Facts columns={1} items={[
                      { label: 'Commit (pinned)', mono: true, value: plan.revision.sha },
                      { label: 'Evidence generated', value: formatDateTime(plan.generatedAt) },
                    ]} /> : null}
                    <Inline>
                      <Button disabled={pending !== '' || !connectionID || !repositoryID} loading={pending === 'discover'} onClick={() => { setChangingRepository(false); void discover() }} size="sm" variant="accent">Discover deployment evidence</Button>
                      {selectedRepository ? <Button disabled={pending !== ''} onClick={() => setChangingRepository(false)} size="sm" variant="ghost">Cancel</Button> : null}
                    </Inline>
                  </Rows>
                </Columns>
              </Rows>
              )}
            </Panel>

            {plan ? <DiscoveryEvidence onChooseService={chooseService} plan={plan} selectedService={selectedService} serviceKey={serviceKey} /> : null}

            {/* 3 — Review. Every stage keeps its place in the column even
                before it can be answered: a step that appears only once it is
                reachable makes the procedure look shorter than it is, and an
                operator cannot see what is still ahead of the deployment. */}
            {!selectedService ? (
              <Panel
                actions={<Inline><Icon name="alert" size="xs" tone="warning" /><Body size="sm">{discovered ? 'Select one deployable service' : 'Waiting on discovery'}</Body></Inline>}
                caption="Review and map services"
                marker="3"
                title="Review"
              />
            ) : (
              <Panel caption="Review and map services" marker="3" title="Review">
                <Rows>
                  {!managerID ? <Banner title="Select a manager before deployment review" tone="warning">You can safely connect providers and inspect source evidence without a manager. Select a connected Swarm manager to load the reviewed application slots and queue a deployment.</Banner> : null}
                  {managerID && !slotCreatable && approved.length === 0 ? <Banner title="No application slots are approved" tone="warning">{platform?.fileManaged ? 'This controller loads its manifest from a file, so the slot has to be declared there. Add an application-profile workload to the mounted manifest, then reconnect the selected manager.' : 'This controller has no platform definition to declare a slot in. Choose one in Platform → Platform definition, then reconnect the selected manager.'}</Banner> : null}
                  {managerID && !unmanaged && slotCreatable && !reviewedSlot && selectedSlot ? <Banner title="This deployment declares a new slot" tone="info">No reviewed slot is named <Mono>{selectedSlot.name}</Mono>, so releasing writes one into the platform definition with the domain and ceiling below. It is checked like any other: a hostname another workload owns is refused rather than taken.</Banner> : null}
                  {unmanaged ? <Banner title="This install has no platform manifest" tone="warning">Slot enforcement is off by declaration, so the name, domain, and reservation below are not checked against a reviewed list. Everything deploys inside the <Mono>{platform?.namespace}</Mono> namespace.</Banner> : null}
                  <Columns>
                    <Rows>
                      {selectedSlot ? <Facts columns={1} items={[
                        { label: newSlot ? 'New slot' : 'Reviewed slot', value: `${selectedSlot.name} · ${managerName ?? managerID}` },
                        { label: 'Resource ceiling', value: `${selectedSlot.replicas} replica${selectedSlot.replicas === 1 ? '' : 's'} · ${selectedSlot.cpuCores} vCPU · ${selectedSlot.memoryMiB} MiB` },
                        { label: 'Certificate resolver', value: selectedSlot.resolver || 'None configured' },
                        { label: 'Domain policy', value: sourceDomainPolicy(selectedSlot) },
                      ]} /> : <Banner title={slotCreatable ? 'Name the application' : 'Map the service to a slot'} tone="info">{slotCreatable ? 'Name this deployment in the deployment plan beside this page. An existing slot is reused; any other name becomes a new one.' : 'Choose an approved application slot in the deployment plan beside this page.'}</Banner>}
                      {newSlot ? (
                        <Columns>
                          <Input hint={unmanaged ? "Nothing reviews this ceiling; the cluster's own capacity decides whether Swarm can schedule it." : 'This becomes the new slot’s reviewed ceiling, and every later deployment into it is held to exactly this.'} label="Replicas" min="1" onChange={(event) => setFreeReplicas(event.target.value)} type="number" value={freeReplicas} />
                          <Input label="vCPU per replica" min="0.1" onChange={(event) => setFreeCPU(event.target.value)} step="0.1" type="number" value={freeCPU} />
                          <Input label="Memory (MiB)" min="64" onChange={(event) => setFreeMemory(event.target.value)} type="number" value={freeMemory} />
                          <Input hint="The Traefik certificate resolver a public domain is issued through." label="Certificate resolver" onChange={(event) => setFreeResolver(event.target.value)} value={freeResolver} />
                        </Columns>
                      ) : null}
                      {selectedSlot ? <Input disabled={!canEditDomain && Boolean(selectedSlot.domain)} id={DOMAIN_FIELD_ID} hint={unmanaged ? 'Any hostname. Nothing checks it against a reviewed list on this install.' : newSlot ? 'The hostname the new slot will own. Leave it empty to deploy with no public route.' : canEditDomain ? dynamicDomainHint(selectedSlot) : 'This reviewed slot owns one fixed hostname.'} label="Application domain" onChange={(event) => setDomain(event.target.value)} placeholder={selectedSlot.domain || selectedSlot.domainSuffixes?.[0] || 'Internal only'} value={domain} /> : null}
                      <Columns>
                        <Input label="Container port" min="1" onChange={(event) => setPort(event.target.value)} type="number" value={port} />
                        <Input label="Health path" onChange={(event) => setHealthPath(event.target.value)} value={healthPath} />
                      </Columns>
                    </Rows>
                    <Rows>
                      <Facts columns={1} items={[
                        { label: 'Source service', mono: true, value: sourceLocation(selectedService) },
                        { label: 'Image', mono: true, value: selectedService.image || 'Resolved by source build' },
                        { label: 'Build', value: selectedService.build?.required ? `${selectedService.build.contextPath || '.'} · ${selectedService.build.dockerfilePath}` : 'Use already-pinned image' },
                        { label: 'Managed databases', value: selectedService.databases?.join(', ') || 'None detected' },
                        { label: 'Shared stacks', value: selectedService.sharedStacks?.join(', ') || telemetryStacks(selectedService) || 'None required' },
                        { label: 'Tracing', value: selectedService.tracing ? 'Use shared Jaeger' : 'Not detected' },
                      ]} />
                      <Banner title="Intent is rewritten, not imported" tone="info">Database containers are replaced with SwarmOps managed services. Prometheus, Alertmanager, Jaeger, and related infrastructure are never deployed from the provider Compose; the approved global stacks are reconciled instead. Unsupported dashboard containers remain blocked.</Banner>
                    </Rows>
                  </Columns>
                </Rows>
              </Panel>
            )}

            {/* 4 — Release. */}
            <Panel
              actions={<Badge pill size="sm" tone="soft" variant={deployBlocks.length === 0 ? 'success' : 'neutral'}>{deployBlocks.length === 0 ? 'Ready to queue' : 'Deployment not ready'}</Badge>}
              caption="Build, verify health, then start first"
              marker="4"
              title="Release"
            >
              <Rows>
                <Body size="sm">The command re-discovers the selected provider project at the pinned commit, rebuilds only the approved context when necessary, pushes it to the configured registry when there is one, enables detected managed databases, reconciles necessary shared platform stacks, and deploys the generated application through policy admission.</Body>
                <Facts columns={3} items={[
                  { label: 'Bounded source builds', value: status.buildEnabled ? 'Enabled' : 'Disabled' },
                  { label: 'Built images go to', value: status.imagePrefixConfigured ? 'The configured registry' : 'The deployment host only' },
                  { label: 'Private provider hosts', value: status.privateHostsConfigured ? 'Configured' : 'Not configured' },
                ]} />
                <Inline><Button disabled={pending !== ''} onClick={() => { setPlan(null); setServiceKey(''); setSlotName('') }} size="sm" variant="secondary">Start another discovery</Button></Inline>
              </Rows>
            </Panel>
          </DetailLayout>
        </>
      )}
    </Screen>
  )
}
