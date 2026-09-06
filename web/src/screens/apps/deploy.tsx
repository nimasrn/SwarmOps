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
  Label,
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
  Command,
  ResourcePlan,
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
import { EnvironmentEditor } from '../../components/environment-editor'
import { environmentErrors, reservedDatabaseNames } from '../../lib/environment'
import { commandFailureText, commandOutcomeTitle, commandOutcomeTone, commandProgressText, isTerminal } from '../../lib/command-outcome'
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
  sourceLocation,
  sourceServiceKey,
  telemetryStacks,
  DOMAIN_FIELD_ID,
  type SourceDraft,
} from './deploy-parts/parts'

interface DeployPageProps {
  managerID: string
  managerName?: string
  /** Where the push registry is configured, now that it is not part of the
      source boundary. */
  onOpenImages?: () => void
  /** Where a deployment that outlives this screen is watched to its end. */
  onOpenRuns?: () => void
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
/** How long this screen watches a deployment before handing it to Activity →
    Runs. A source deployment builds an image first, so the budget is minutes,
    not the seconds a resource command takes. */
const DEPLOY_FOLLOW_MS = 10 * 60 * 1000

const PROVIDERS: { label: string; value: SourceProviderKind }[] = [
  { label: 'GitHub or GitHub Enterprise', value: 'github' },
  { label: 'GitLab or self-managed GitLab', value: 'gitlab' },
  { label: 'Gitea or Forgejo', value: 'gitea' },
]

export function DeployPage({ managerID, managerName, onOpenImages, onOpenRuns, onOpenWorkloads, toast }: DeployPageProps) {
  const [source, setSource] = useState<DeploySource>('repository')
  const [status, setStatus] = useState<SourceStatus | null>(null)
  const [connections, setConnections] = useState<SourceConnection[]>([])
  const [repositories, setRepositories] = useState<SourceRepository[]>([])
  const [plans, setPlans] = useState<ResourcePlan[]>([])
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
  const [applicationName, setApplicationName] = useState('')
  const [domain, setDomain] = useState('')
  const [port, setPort] = useState('8080')
  const [healthPath, setHealthPath] = useState('/healthz')
  const [metricsEnabled, setMetricsEnabled] = useState(false)
  // Size is a named plan chosen here, per deployment, and changed on the next
  // one. Nothing has to declare it in advance and nothing outside this screen
  // has an opinion about it.
  const [sizeName, setSizeName] = useState('')
  const [replicas, setReplicas] = useState('1')
  const [resolver, setResolver] = useState('http')
  const [environment, setEnvironment] = useState<Record<string, string>>({})
  // What the queued command is doing, and how it ended. A deployment used to
  // be reported as "queued" and nothing else, which reads as done.
  const [progress, setProgress] = useState('')
  const [outcome, setOutcome] = useState<Command | null>(null)
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
  const selectedSize = plans.find((candidate) => candidate.name === sizeName)
  const selectedServiceFindings = selectedService?.findings ?? []
  const blockers = selectedServiceFindings.filter((finding) => finding.level === 'blocker')
  // A detected engine delivers its URI under the names the scanner found in
  // the repository's own Compose, plus <ENGINE>_URL. Reserving them here shows
  // a collision on the field instead of returning it as a refusal.
  const reservedEnvironmentNames = useMemo(
    () => reservedDatabaseNames(
      selectedService?.databases ?? [],
      (selectedService?.databaseRequirements ?? []).map((requirement) => requirement.envVars ?? []),
    ),
    [selectedService],
  )
  const environmentProblems = environmentErrors(environment, reservedEnvironmentNames)

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

  // The sizes come from the controller rather than from a list typed into this
  // file, so the console offers exactly what the controller will accept.
  const loadPlans = useCallback(async () => {
    try {
      const offered = await api.applicationPlans()
      const list = normalizeArray(offered?.plans)
      setPlans(list)
      setSizeName((current) => list.some((candidate) => candidate.name === current) ? current : offered?.default ?? list[0]?.name ?? '')
    } catch (reason) {
      setPlans([])
      setError(messageOf(reason))
    }
  }, [])

  useEffect(() => { void loadSource().catch((reason) => setError(messageOf(reason))) }, [loadSource])
  useEffect(() => { void loadPlans() }, [loadPlans])
  useEffect(() => {
    setApplicationName('')
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
  // The service names itself, and the hostname it already routes on is a
  // better proposal than an empty field. Both stay editable.
  useEffect(() => {
    if (!selectedService || applicationName) return
    setApplicationName(selectedService.name)
    setDomain(selectedService.route?.hosts?.[0] ?? '')
  }, [applicationName, selectedService])

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
    setApplicationName('')
  }

  const chooseRepository = (next: string) => {
    const repository = repositories.find((candidate) => candidate.id === next)
    setRepositoryID(next)
    setRef(repository?.defaultBranch ?? '')
    setPlan(null)
    setServiceKey('')
    setApplicationName('')
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
      setApplicationName('')
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
    setApplicationName('')
    if (service) {
      setPort(String(service.route?.targetPort || service.port || 8080))
      setHealthPath(service.healthPath || '/healthz')
      setMetricsEnabled(Boolean(service.metrics))
    }
  }

  // A draft is the selection, never the evidence: no path, digest, finding, or
  // provider response is written to browser storage, so a saved draft cannot
  // become a copy of someone's repository sitting in localStorage. The
  // environment is left out for the same reason — its values are whatever the
  // operator pasted, and this console has no business keeping them on disk.
  const writeDraft = useCallback(() => {
    if (!managerID) return false
    const draft: SourceDraft = { connectionID, domain, healthPath, managerID, metricsEnabled, port, ref, repositoryID, savedAt: new Date().toISOString(), serviceKey, slotName: applicationName, source }
    try {
      window.localStorage.setItem(draftKey(managerID), JSON.stringify(draft))
      setDraftSavedAt(draft.savedAt)
      return true
    } catch {
      return false
    }
  }, [applicationName, connectionID, domain, healthPath, managerID, metricsEnabled, port, ref, repositoryID, serviceKey, source])

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
      setApplicationName(draft.slotName)
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
    if (!plan || !selectedService || !applicationName.trim() || !connectionID || !repositoryID || blockers.length > 0 || !managerID) return
    if (environmentProblems.length > 0) return
    setPending('deploy')
    setError('')
    setOutcome(null)
    setProgress('')
    try {
      // Size is sent as a plan name. The controller resolves it, so the
      // console never has to hold the numbers a plan stands for.
      const application: ApplicationSpec = {
        domain: domain.trim(),
        healthPath: healthPath.trim(),
        image: '',
        metrics: metricsEnabled,
        name: applicationName.trim(),
        plan: sizeName,
        port: Number(port),
        replicas: Number(replicas) || 1,
        resolver: domain.trim() ? resolver.trim() : '',
        // The spec field carries no JSON tag, so the wire name is the Go
        // field name. Sending "env" would deploy with no environment at all.
        Env: Object.keys(environment).length > 0 ? environment : undefined,
      }
      const command = await api.deploySource({
        composePath: selectedService.composePath,
        connectionId: connectionID,
        planId: plan.id,
        repositoryId: repositoryID,
        revision: plan.revision.sha,
        service: selectedService.service,
      }, application)
      // The controller answers 202 with the command even when storing the
      // source input failed, deliberately: a durable attention record is
      // better than an opaque error. Reporting that record as "queued" is
      // what turned a stated failure into a deployment the operator believed
      // was running — so the command is followed to whatever it becomes.
      const final = isTerminal(command.state)
        ? command
        : await api.waitForCommand(command.id, DEPLOY_FOLLOW_MS, (update) => setProgress(commandProgressText(update)))
      setProgress('')
      setOutcome(final)
      if (final.state === 'succeeded') {
        toast({ message: `${applicationName.trim()} is deployed (${shortID(final.id)})`, tone: 'success' })
      } else if (isTerminal(final.state)) {
        const reason = commandFailureText(final)
        setError(reason)
        toast({ duration: 0, message: reason, tone: 'danger' })
      } else {
        // The budget ran out; the command did not. Saying so is the honest
        // report — a timeout here is this screen giving up watching, not the
        // deployment failing.
        toast({ message: `${applicationName.trim()} is still deploying as ${shortID(final.id)}. It continues without this screen.`, tone: 'neutral' })
      }
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
    applicationName,
    environmentProblems,
    managerID,
    selectedService,
    status,
    blockers,
  })
  const discovered = Boolean(plan)

  const stages: Stage[] = [
    { caption: 'Provider and repository', id: 'source', label: 'Source', status: repositoryID ? 'done' : 'active' },
    { caption: 'Scan complete tree', id: 'discover', label: 'Discovery', status: discovered ? 'done' : repositoryID ? 'active' : 'pending' },
    { caption: 'Name and validate', id: 'review', label: 'Review', status: blockers.length ? 'blocked' : selectedService && applicationName.trim() ? 'done' : discovered ? 'active' : 'pending' },
    {
      caption: outcome && outcome.state !== 'succeeded' ? 'Ended without serving' : pending === 'deploy' ? progress || 'Queued' : 'Build and start first',
      id: 'release',
      label: 'Release',
      status: outcome?.state === 'succeeded' ? 'done' : outcome ? 'blocked' : pending === 'deploy' ? 'active' : deployBlocks.length === 0 ? 'active' : 'pending',
    },
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
                applicationName={applicationName}
                draftSavedAt={draftSavedAt}
                onSaveDraft={saveDraft}
                plan={plan}
                blocks={deployBlocks}
                domain={domain}
                findings={[...(plan?.findings ?? []), ...selectedServiceFindings]}
                metrics={metricsEnabled}
                onDeploy={() => void deploy()}
                onRenameApplication={setApplicationName}
                onToggleMetrics={setMetricsEnabled}
                pending={pending}
                resolver={resolver}
                selectedService={selectedService}
                size={selectedSize ? `${selectedSize.name} · ${selectedSize.cpuCores} vCPU · ${selectedSize.memoryMiB} MiB` : sizeName || 'default'}
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
                  {!managerID ? <Banner title="Select a manager before deployment review" tone="warning">You can safely connect providers and inspect source evidence without a manager. Select a connected Swarm manager to queue a deployment.</Banner> : null}
                  <Columns>
                    <Rows>
                      <Facts columns={1} items={[
                        { label: 'Application', value: `${applicationName || selectedService.name} · ${managerName ?? managerID}` },
                        { label: 'Size', value: selectedSize ? `${selectedSize.cpuCores} vCPU · ${selectedSize.memoryMiB} MiB per replica` : 'Default' },
                      ]} />
                      {/* Nothing here has to exist before the deployment. The
                          name is the service's own, the size is a named plan,
                          and the hostname is whatever the operator types. */}
                      <Input hint="This is the application name, and the stack it deploys into. It is taken from the source service and can be changed." label="Application name" onChange={(event) => setApplicationName(event.target.value)} value={applicationName} />
                      <Columns>
                        <Select hint={selectedSize?.summary} label="Size" onChange={(event) => setSizeName(event.target.value)} options={plans.map((candidate) => ({ label: `${candidate.name} · ${candidate.cpuCores} vCPU · ${candidate.memoryMiB} MiB`, value: candidate.name }))} value={sizeName} />
                        <Input label="Replicas" min="1" onChange={(event) => setReplicas(event.target.value)} type="number" value={replicas} />
                      </Columns>
                      <Input id={DOMAIN_FIELD_ID} hint="Any hostname you control. Leave it empty to deploy with no public route." label="Application domain" onChange={(event) => setDomain(event.target.value)} placeholder="Internal only" value={domain} />
                      {domain.trim() ? <Input hint="HTTP-01 needs no DNS credential and is the default. Name another Traefik resolver only if you configured one." label="Certificate resolver" onChange={(event) => setResolver(event.target.value)} value={resolver} /> : null}
                      <Columns>
                        <Input label="Container port" min="1" onChange={(event) => setPort(event.target.value)} type="number" value={port} />
                        <Input label="Health path" onChange={(event) => setHealthPath(event.target.value)} value={healthPath} />
                      </Columns>
                      <Rows gap="tight">
                        <Label>Environment</Label>
                        <Body size="sm" tone="muted">Set on the deployed service. A detected managed database delivers its own connection URI; it does not belong here.</Body>
                        <EnvironmentEditor onChange={setEnvironment} reserved={reservedEnvironmentNames} value={environment} />
                        {environmentProblems.length > 0 ? <Banner title="The environment is not deployable yet" tone="warning">{environmentProblems.join(' ')}</Banner> : null}
                      </Rows>
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
                {pending === 'deploy' ? (
                  <Banner title="The deployment is running" tone="info">
                    {progress || 'Queued'}. This screen watches it for ten minutes; the command outlives the screen either way.
                  </Banner>
                ) : null}
                {outcome ? (
                  outcome.state === 'succeeded'
                    ? (
                      <Banner title="The application is deployed" tone="success">
                        Command <Mono>{shortID(outcome.id)}</Mono> succeeded. Open Applications to see it serving.
                      </Banner>
                    )
                    : (
                      <Banner
                        action={onOpenRuns ? <Button onClick={onOpenRuns} size="sm" variant="secondary">Open Runs</Button> : null}
                        title={commandOutcomeTitle(outcome)}
                        tone={commandOutcomeTone(outcome)}
                      >
                        {commandFailureText(outcome)}
                      </Banner>
                    )
                ) : null}
                <Inline><Button disabled={pending !== ''} onClick={() => { setPlan(null); setServiceKey(''); setApplicationName(''); setOutcome(null) }} size="sm" variant="secondary">Start another discovery</Button></Inline>
              </Rows>
            </Panel>
          </DetailLayout>
        </>
      )}
    </Screen>
  )
}
