import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Accordion,
  Badge,
  BrandMark,
  Banner,
  Button,
  Columns,
  CopyChip,
  DataTable,
  DetailHeader,
  DetailLayout,
  EmptyState,
  Facts,
  Icon,
  Inline,
  Input,
  Label,
  List,
  ListRow,
  Mono,
  Page,
  Panel,
  Rail,
  RailSection,
  RecordLink,
  Select,
  Spinner,
  StageTrack,
  Stack as Rows,
  Switch,
  Body,
  useToast,
} from '@nim.zone/ui'
import { brandFor } from '@nim.zone/ui'
import type { BadgeVariant, Stage, TableColumn } from '@nim.zone/ui'
import { api } from './api'
import type {
  ApplicationSpec,
  ApprovedWorkload,
  SourceClassification,
  SourceConnection,
  SourceEvidenceFile,
  SourceFinding,
  SourcePlan,
  SourceProviderKind,
  SourceRepository,
  SourceServicePlan,
  SourceStatus,
} from './types'

interface SourceDeployPageProps {
  managerID: string
  managerName?: string
  toast: ReturnType<typeof useToast>
}

const PROVIDERS: { label: string; value: SourceProviderKind }[] = [
  { label: 'GitHub or GitHub Enterprise', value: 'github' },
  { label: 'GitLab or self-managed GitLab', value: 'gitlab' },
  { label: 'Gitea or Forgejo', value: 'gitea' },
]

export function SourceDeployPage({ managerID, managerName, toast }: SourceDeployPageProps) {
  const [status, setStatus] = useState<SourceStatus | null>(null)
  const [connections, setConnections] = useState<SourceConnection[]>([])
  const [repositories, setRepositories] = useState<SourceRepository[]>([])
  const [approved, setApproved] = useState<ApprovedWorkload[]>([])
  const [plan, setPlan] = useState<SourcePlan | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState('')

  const [provider, setProvider] = useState<SourceProviderKind>('github')
  const [connectionName, setConnectionName] = useState('GitHub source')
  const [baseURL, setBaseURL] = useState('')
  const [token, setToken] = useState('')
  const [editingConnectionID, setEditingConnectionID] = useState('')
  const [removingConnectionID, setRemovingConnectionID] = useState('')
  const [removeConnectionConfirmation, setRemoveConnectionConfirmation] = useState('')

  const [connectionID, setConnectionID] = useState('')
  const [repositoryID, setRepositoryID] = useState('')
  const [ref, setRef] = useState('')
  const [serviceKey, setServiceKey] = useState('')
  const [slotName, setSlotName] = useState('')
  const [domain, setDomain] = useState('')
  const [port, setPort] = useState('8080')
  const [healthPath, setHealthPath] = useState('/healthz')
  const [metricsEnabled, setMetricsEnabled] = useState(false)
  const [draftSavedAt, setDraftSavedAt] = useState('')
  const [managing, setManaging] = useState(false)
  const [changingRepository, setChangingRepository] = useState(false)

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
  const selectedSlot = approved.find((slot) => slot.name === slotName)
  const selectedServiceFindings = selectedService?.findings ?? []
  const blockers = selectedServiceFindings.filter((finding) => finding.level === 'blocker')
  const canEditDomain = Boolean(selectedSlot?.domainOptional || selectedSlot?.domainSuffixes?.length)

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

  const loadRepositories = useCallback(async (id: string) => {
    if (!id) {
      setRepositories([])
      return
    }
    setPending('repositories')
    setError('')
    try {
      const nextRepositories = normalizeArray(await api.sourceRepositories(id))
      setRepositories(nextRepositories)
      const nextRepository = nextRepositories[0]
      setRepositoryID(nextRepository?.id ?? '')
      setRef(nextRepository?.defaultBranch ?? '')
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
      return
    }
    try {
      setApproved(normalizeArray(await api.approvedApplications()))
    } catch (reason) {
      setApproved([])
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
    setServiceKey('')
    void loadRepositories(connectionID)
  }, [connectionID, loadRepositories, status?.enabled])
  useEffect(() => {
    if (!selectedService || slotName || approved.length === 0) return
    const matching = approved.find((slot) => slot.name === selectedService.name) ?? approved[0]
    if (matching) selectSlot(matching.name, approved, setSlotName, setDomain)
  }, [approved, selectedService, slotName])

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
    setRemoveConnectionConfirmation('')
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

  const removeConnection = async () => {
    const connection = connections.find((candidate) => candidate.id === removingConnectionID)
    if (!connection || removeConnectionConfirmation !== removalPhrase(connection)) return
    setPending('connection-remove')
    setError('')
    try {
      await api.removeSourceConnection(connection.id)
      setConnections((current) => current.filter((candidate) => candidate.id !== connection.id))
      if (connectionID === connection.id) chooseConnection('')
      setRemovingConnectionID('')
      setRemoveConnectionConfirmation('')
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
      setPort(String(service.port || 8080))
      setHealthPath(service.healthPath || '/healthz')
      setMetricsEnabled(Boolean(service.metrics))
    }
  }

  const chooseSlotName = (next: string) => selectSlot(next, approved, setSlotName, setDomain)

  // A draft is the selection, never the evidence: no path, digest, finding, or
  // provider response is written to browser storage, so a saved draft cannot
  // become a copy of someone's repository sitting in localStorage.
  const saveDraft = () => {
    if (!managerID) return
    const draft: SourceDraft = { connectionID, domain, healthPath, managerID, metricsEnabled, port, ref, repositoryID, savedAt: new Date().toISOString(), serviceKey, slotName }
    try {
      window.localStorage.setItem(draftKey(managerID), JSON.stringify(draft))
      setDraftSavedAt(draft.savedAt)
      toast({ message: 'Deployment plan draft saved in this browser', tone: 'success' })
    } catch {
      toast({ message: 'This browser refused to store the draft', tone: 'danger' })
    }
  }

  const restoreDraft = useCallback(() => {
    if (!managerID) return
    let stored: string | null = null
    try {
      stored = window.localStorage.getItem(draftKey(managerID))
    } catch {
      return
    }
    if (!stored) return
    try {
      const draft = JSON.parse(stored) as SourceDraft
      setConnectionID(draft.connectionID)
      setRepositoryID(draft.repositoryID)
      setRef(draft.ref)
      setSlotName(draft.slotName)
      setDomain(draft.domain)
      setPort(draft.port)
      setHealthPath(draft.healthPath)
      setMetricsEnabled(draft.metricsEnabled)
      setDraftSavedAt(draft.savedAt)
    } catch {
      // A draft this console cannot read is a draft it discards. It holds no
      // information the operator cannot re-enter in four fields.
      window.localStorage.removeItem(draftKey(managerID))
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
    return <Page><Spinner label="Reading source deployment capability" /></Page>
  }

  const deployBlocks = deploymentBlocks({
    managerID,
    selectedService,
    selectedSlot,
    status,
    blockers,
  })
  const discovered = Boolean(plan)

  const stages: Stage[] = [
    { caption: 'Provider and repository', id: 'source', label: 'Source', status: repositoryID ? 'done' : 'active' },
    { caption: 'Scan complete tree', id: 'discover', label: 'Discovery', status: discovered ? 'done' : repositoryID ? 'active' : 'pending' },
    { caption: 'Map and validate', id: 'review', label: 'Review', status: blockers.length ? 'blocked' : selectedService && selectedSlot ? 'done' : discovered ? 'active' : 'pending' },
    { caption: 'Build and start first', id: 'release', label: 'Release', status: deployBlocks.length === 0 ? 'active' : 'pending' },
  ]

  return (
    <Page width="full">
      {error ? <Banner title="Source deployment needs attention" tone="danger">{error}</Banner> : null}
      {!status.enabled ? (
        <Panel eyebrow="Disabled by default" marker={<Icon name="lock" size="sm" />} title="Enable the sealed source boundary">
          <Rows>
            <Body size="sm">Source deploy is intentionally off until this controller is configured with <Mono>SWARMOPS_SOURCE_ENABLED=true</Mono>. Configure an allow-listed private-provider host only when you need GitHub Enterprise, self-managed GitLab, Gitea, or Forgejo.</Body>
            <Facts items={[
              { label: 'Private provider hosts', value: status.privateHostsConfigured ? 'Configured' : 'Not configured' },
              { label: 'Registry image prefix', value: status.imagePrefixConfigured ? 'Configured' : 'Not configured' },
              { label: 'Bounded source builds', value: status.buildEnabled ? 'Enabled' : 'Disabled' },
            ]} />
          </Rows>
        </Panel>
      ) : (
        <>
          <DetailHeader title="Deploy application" />
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
                          <Mono>{selectedConnection.account || '—'}</Mono>
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
                {selectedConnection ? <Inline><Button disabled={pending !== ''} onClick={() => beginConnectionEdit(selectedConnection)} size="sm" variant="secondary">Replace selected token</Button><Button disabled={pending !== ''} onClick={() => { setRemovingConnectionID(selectedConnection.id); setRemoveConnectionConfirmation('') }} size="sm" variant="ghost">Remove selected connection</Button></Inline> : null}
                {removingConnectionID ? <Rows><Banner title="Remove this sealed connection" tone="warning">Removing a connection stops future provider access; it does not change deployed applications or their source-independent command records.</Banner><Input label="Removal confirmation" onChange={(event) => setRemoveConnectionConfirmation(event.target.value)} placeholder={removalPhrase(connections.find((connection) => connection.id === removingConnectionID))} value={removeConnectionConfirmation} /><Inline><Button disabled={pending !== '' || removeConnectionConfirmation !== removalPhrase(connections.find((connection) => connection.id === removingConnectionID))} loading={pending === 'connection-remove'} onClick={() => void removeConnection()} size="sm" variant="danger">Remove connection</Button><Button disabled={pending !== ''} onClick={() => { setRemovingConnectionID(''); setRemoveConnectionConfirmation('') }} size="sm" variant="ghost">Keep connection</Button></Inline></Rows> : null}
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
                  {managerID && approved.length === 0 ? <Banner title="No application slots are approved" tone="warning">Add an application-profile workload to the reviewed platform manifest, then reconnect the selected manager.</Banner> : null}
                  <Columns>
                    <Rows>
                      {selectedSlot ? <Facts columns={1} items={[
                        { label: 'Reviewed slot', value: `${selectedSlot.name} · ${managerName ?? managerID}` },
                        { label: 'Resource ceiling', value: `${selectedSlot.replicas} replica${selectedSlot.replicas === 1 ? '' : 's'} · ${selectedSlot.cpuCores} vCPU · ${selectedSlot.memoryMiB} MiB` },
                        { label: 'Certificate resolver', value: selectedSlot.resolver || '—' },
                        { label: 'Domain policy', value: sourceDomainPolicy(selectedSlot) },
                      ]} /> : <Banner title="Map the service to a slot" tone="info">Choose an approved application slot in the deployment plan beside this page.</Banner>}
                      {selectedSlot ? <Input disabled={!canEditDomain && Boolean(selectedSlot.domain)} id={DOMAIN_FIELD_ID} hint={canEditDomain ? dynamicDomainHint(selectedSlot) : 'This reviewed slot owns one fixed hostname.'} label="Application domain" onChange={(event) => setDomain(event.target.value)} placeholder={selectedSlot.domain || selectedSlot.domainSuffixes?.[0] || 'Internal only'} value={domain} /> : null}
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
                <Body size="sm">The command re-discovers the selected provider project at the pinned commit, rebuilds only the approved context when necessary, pushes it through the configured registry credential, enables detected managed databases, reconciles necessary shared platform stacks, and deploys the generated application through policy admission.</Body>
                <Facts columns={3} items={[
                  { label: 'Bounded source builds', value: status.buildEnabled ? 'Enabled' : 'Disabled' },
                  { label: 'Registry image prefix', value: status.imagePrefixConfigured ? 'Configured' : 'Not configured' },
                  { label: 'Private provider hosts', value: status.privateHostsConfigured ? 'Configured' : 'Not configured' },
                ]} />
                <Inline><Button disabled={pending !== ''} onClick={() => { setPlan(null); setServiceKey(''); setSlotName('') }} size="sm" variant="secondary">Start another discovery</Button></Inline>
              </Rows>
            </Panel>
          </DetailLayout>
        </>
      )}
    </Page>
  )
}

/* The standing summary of the deployment this page is assembling. It is the
   only place the deploy command is issued from: the panels beside it collect
   decisions, and this rail is where they are read back and committed. */
function DeploymentPlan({
  approved,
  blocks,
  domain,
  draftSavedAt,
  findings,
  metrics,
  onChooseSlot,
  onDeploy,
  onSaveDraft,
  onToggleMetrics,
  pending,
  plan,
  selectedService,
  selectedSlot,
  slotName,
}: {
  approved: ApprovedWorkload[]
  blocks: string[]
  domain: string
  draftSavedAt: string
  findings: SourceFinding[]
  metrics: boolean
  onChooseSlot: (name: string) => void
  onDeploy: () => void
  onSaveDraft: () => void
  onToggleMetrics: (next: boolean) => void
  pending: string
  plan: SourcePlan | null
  selectedService?: SourceServicePlan
  selectedSlot?: ApprovedWorkload
  slotName: string
}) {
  const warnings = findings.filter((finding) => finding.level !== 'blocker')
  const blockers = findings.filter((finding) => finding.level === 'blocker')
  const databases = selectedService?.databases ?? []
  // The rail names the stacks the way the discovery found them — Prometheus,
  // Jaeger and logging collectors — rather than the reviewed platform stacks they are
  // reconciled into. What SwarmOps owns is one stack; what an operator is
  // deciding about is the three signals they wrote into their Compose.
  const stacks = plan
    ? plan.services.filter((service) => service.classification === 'shared_platform').map((service) => stackName(service.name))
    : selectedService?.sharedStacks ?? []

  return (
    <>
      <Rail
      actions={<Button disabled={!selectedService || pending !== ''} onClick={onSaveDraft} size="sm" variant="secondary">Save draft</Button>}
      footer={
        <>
          <Button disabled={pending !== '' || blocks.length > 0} fullWidth iconStart="play" loading={pending === 'deploy'} onClick={onDeploy} variant="accent">Release application</Button>
          <span>{blocks.length > 0 ? 'Resolve blockers to enable deployment' : 'The worker owns the build and deployment lifecycle'}</span>
          {draftSavedAt ? <span>Draft saved {formatDateTime(draftSavedAt)} · this browser only</span> : null}
        </>
      }
      title="Deployment plan"
    >
      <RailSection meta={selectedService ? '1 service' : '—'} title="Applications">
        {selectedService ? (
          <List plain>
            <ListRow
              leading={<Icon name="check-circle" size="sm" tone="success" />}
              title={selectedService.name}
              trailing={
                <Inline gap="tight">
                  <Label>Slot</Label>
                  <Select aria-label="Approved slot" onChange={(event) => onChooseSlot(event.target.value)} options={approved.map((slot) => ({ label: slot.name, value: slot.name }))} placeholder="Slot" value={slotName} />
                </Inline>
              }
            />
          </List>
        ) : (
          <Body size="sm">No service is selected yet.</Body>
        )}
      </RailSection>

      <RailSection meta={selectedService ? '1 image' : '—'} title="Images (immutable)">
        {selectedService ? (
          <List plain>
            <ListRow
              leading={<Icon name="package" size="sm" />}
              subtitle={selectedService.image || 'Built from the pinned source context'}
              title={selectedService.name}
              trailing={plan ? <CopyChip>{plan.revision.sha.slice(0, 7)}</CopyChip> : null}
            />
          </List>
        ) : (
          <Body size="sm">Resolved once a service is selected.</Body>
        )}
      </RailSection>

      <RailSection meta={`${databases.length} resource${databases.length === 1 ? '' : 's'}`} title="Managed databases">
        {databases.length ? (
          <List plain>
            {databases.map((database) => (
              <ListRow key={database} leading={<DependencyMark name={database} fallback="database" />} subtitle="Managed by SwarmOps" title={engineName(database)} trailing={<Icon name="check" size="xs" tone="success" />} />
            ))}
          </List>
        ) : (
          <Body size="sm">None detected in the provider Compose.</Body>
        )}
      </RailSection>

      <RailSection meta={`${stacks.length} stack${stacks.length === 1 ? '' : 's'}`} title="Shared platform stacks">
        {stacks.length ? (
          <List plain>
            {stacks.map((stack) => (
              <ListRow key={stack} leading={<DependencyMark name={stack} fallback="layers" />} subtitle="Global stack" title={stack} trailing={<Body size="sm" tone="accent">Managed</Body>} />
            ))}
          </List>
        ) : (
          <Body size="sm">No shared stack is required.</Body>
        )}
      </RailSection>

      <RailSection meta={<EditLink label="Edit domain" target={DOMAIN_FIELD_ID} />} title="Domain">
        <Body size="sm">{domain || selectedSlot?.domain || 'Internal only — no public route'}</Body>
        <Body size="sm" tone="muted">{selectedSlot ? `Certificate resolver: ${selectedSlot.resolver || 'none'}` : 'A reviewed slot owns the domain policy.'}</Body>
      </RailSection>

      <RailSection meta={<EditLink label="Edit telemetry" target={TELEMETRY_FIELD_ID} />} title="Telemetry">
        <Switch checked={metrics} id={TELEMETRY_FIELD_ID} onChange={(event) => onToggleMetrics(event.target.checked)}>Metrics (Prometheus)</Switch>
        {/* Traces and logs are reported, not switched. Both are cluster-wide
            reviewed stacks: turning one on from a deployment plan would queue
            a platform change under the heading of one application. */}
        <Switch checked={Boolean(selectedService?.tracing)} disabled readOnly>Traces (OpenTelemetry)</Switch>
        <Switch checked={stacks.some((stack) => ['loki','alloy','promtail','fluentd','fluent-bit'].some(name => stack.toLowerCase().includes(name)))} disabled readOnly>Logs (replaced by SwarmOps Fluentd)</Switch>
        <Body size="sm" tone="muted">Traces and logs follow the cluster's reviewed observability stacks; change them on the Observability page.</Body>
      </RailSection>

      {warnings.length ? (
        <RailSection meta={String(warnings.length)} title="Warnings" tone="warning">
          <List plain>
            {warnings.map((finding) => (
              <ListRow key={`${finding.code}/${finding.subject ?? ''}`} leading={<Icon name="alert" size="sm" tone="warning" />} title={finding.message} />
            ))}
          </List>
        </RailSection>
      ) : null}

      {blockers.length || blocks.length ? (
        <RailSection meta={String(blockers.length + blocks.length)} title="Blockers" tone="danger">
          <List plain>
            {blockers.map((finding) => (
              <ListRow key={`${finding.code}/${finding.subject ?? ''}`} leading={<Icon name="danger" size="sm" tone="danger" />} title={finding.message} />
            ))}
            {blocks.map((block) => (
              <ListRow key={block} leading={<Icon name="danger" size="sm" tone="danger" />} title={block} />
            ))}
          </List>
        </RailSection>
      ) : null}
      </Rail>
      <Banner icon="lock" title="Source contents stay at the provider" tone="neutral">SwarmOps never stores your source contents or tokens. Repositories are read on demand at the pinned revision and are not persisted.</Banner>
    </>
  )
}

// The rail names a control that lives in the review stage; this is the walk
// back to it. Focus follows the scroll, because a link that only scrolls
// leaves a keyboard operator exactly where they were.
function EditLink({ label, target }: { label: string; target: string }) {
  return (
    <Button
      aria-label={label}
      onClick={() => {
        const field = document.getElementById(target)
        field?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        field?.focus({ preventScroll: true })
      }}
      size="sm"
      variant="ghost"
    >
      Edit
    </Button>
  )
}

const DOMAIN_FIELD_ID = 'swarmops-source-domain'
const TELEMETRY_FIELD_ID = 'swarmops-source-metrics'

interface SourceDraft {
  connectionID: string
  domain: string
  healthPath: string
  managerID: string
  metricsEnabled: boolean
  port: string
  ref: string
  repositoryID: string
  savedAt: string
  serviceKey: string
  slotName: string
}

function draftKey(managerID: string) {
  return `swarmops.source-draft.${managerID}`
}

function maskedToken(connection: SourceConnection) {
  const prefix = connection.kind === 'github' ? 'ghp_' : connection.kind === 'gitlab' ? 'glpat-' : 'gta_'
  return `${prefix}${'•'.repeat(28)}`
}

// The provider names a container; the platform names an engine. A row that
// says "postgres" is naming the source service, and the whole point of this
// rail is that the source service is not what gets deployed.
function DependencyMark({ fallback, name }: { fallback: 'database' | 'layers'; name: string }) {
  const brand = brandFor(name)
  return brand ? <BrandMark name={brand} size="sm" /> : <Icon name={fallback} size="sm" />
}

// Same rule as an engine: the platform names the product, not the container.
function stackName(stack: string) {
  const stacks: Record<string, string> = { alertmanager: 'Alertmanager', alloy: 'Source logging collector', cadvisor: 'cAdvisor', fluentd: 'Source logging collector', 'fluent-bit': 'Source logging collector', jaeger: 'Jaeger', loki: 'Source logging collector', promtail: 'Source logging collector', 'node-exporter': 'Node exporter', prometheus: 'Prometheus' }
  return stacks[stack.toLowerCase()] ?? stack
}

function engineName(database: string) {
  const engines: Record<string, string> = { mongo: 'MongoDB', mongodb: 'MongoDB', postgres: 'PostgreSQL', postgresql: 'PostgreSQL', redis: 'Redis', valkey: 'Valkey' }
  return engines[database.toLowerCase()] ?? database
}

function providerOrigin(baseUrl: string) {
  if (!baseUrl) return '—'
  try {
    return new URL(baseUrl).origin
  } catch {
    return baseUrl
  }
}

// The scan reports what it walked, not how many files it read: "across N
// directories" is the number an operator uses to judge whether the discovery
// covered the monorepo they had in mind.
function directoryCount(plan: SourcePlan) {
  const directories = new Set<string>()
  for (const file of [...plan.composeFiles, ...plan.dockerfiles]) {
    const slash = file.path.lastIndexOf('/')
    directories.add(slash === -1 ? '.' : file.path.slice(0, slash))
  }
  return directories.size
}


function DiscoveryEvidence({ onChooseService, plan, selectedService, serviceKey }: { onChooseService: (key: string) => void; plan: SourcePlan; selectedService?: SourceServicePlan; serviceKey: string }) {
  const allServices = plan.services
  const applications = allServices.filter((service) => service.classification === 'application')
  return (
    <>
      <Panel actions={<Inline><Icon name="check-circle" size="xs" tone="success" /><Body size="sm">No repository data retained</Body></Inline>} caption={`Scan completed ${formatDateTime(plan.generatedAt)}`} eyebrow="Discovery" marker="2" title={`Service classification (${allServices.length} total)`}>
        <Rows>
          <Inline>
            <Badge variant="neutral">{plan.composeFiles.length} Compose</Badge>
            <Badge variant="neutral">{plan.dockerfiles.length} Dockerfiles</Badge>
            <Badge variant="neutral">{directoryCount(plan)} directories</Badge>
            <Badge variant={plan.ready ? 'success' : 'warning'}>{applications.filter((service) => !hasBlocker(service.findings)).length} deployable</Badge>
            <Body size="sm">Pinned <Mono>{shortID(plan.revision.sha)}</Mono> from <Mono>{plan.repository.path}</Mono></Body>
          </Inline>
          <DataTable
            caption="Source service classifications"
            columns={serviceColumns}
            empty={<EmptyState description="The selected revision contained no deployable service evidence." icon="layers" title="No services discovered" />}
            rowKey={(service) => sourceServiceKey(service)}
            rows={allServices}
          />
          {applications.length > 0 ? <Select label="Deployable source service" onChange={(event) => onChooseService(event.target.value)} options={applications.map((service) => ({ label: `${service.name} · ${service.composePath || 'standalone Dockerfile'}`, value: sourceServiceKey(service) }))} value={serviceKey} /> : null}
          <Accordion items={[{ content: <Columns><Rows><Label>Compose files</Label><EvidenceTable empty="No Compose files were found; standalone Dockerfiles were inspected." files={plan.composeFiles} /></Rows><Rows><Label>Dockerfiles</Label><EvidenceTable empty="No Dockerfiles were found." files={plan.dockerfiles} /></Rows></Columns>, id: 'evidence', title: 'View all evidence' }]} variant="plain" />
        </Rows>
      </Panel>
      {!selectedService && applications.length > 0 ? <Banner title="Choose one application" tone="info">A source discovery can find several deployable services in a monorepo. Select exactly one service and map it to one approved platform slot for each deployment.</Banner> : null}
    </>
  )
}

function EvidenceTable({ empty, files }: { empty: string; files: SourceEvidenceFile[] }) {
  const columns: TableColumn<SourceEvidenceFile>[] = [
    { header: 'Path', key: 'path', render: (file) => <Mono>{file.path}</Mono> },
    { header: 'Size', key: 'size', numeric: true, render: (file) => formatBytes(file.size) },
    { header: 'Evidence digest', key: 'digest', render: (file) => <Mono>{shortDigest(file.digest)}</Mono> },
  ]
  return <DataTable caption="Source file evidence" columns={columns} empty={<EmptyState description={empty} icon="document" title="No file evidence" />} rowKey={(file) => file.path} rows={files} />
}

const serviceColumns: TableColumn<SourceServicePlan>[] = [
  { header: 'Service', key: 'service', render: (service) => <Inline><ServiceMark service={service} />{service.name}</Inline> },
  { header: 'Type', key: 'type', render: (service) => serviceKind(service) },
  { header: 'Source location', key: 'location', render: (service) => <Mono>{service.composePath || 'standalone Dockerfile'}</Mono> },
  { header: 'Classification', key: 'classification', render: (service) => <ClassificationBadge classification={service.classification} /> },
  {
    header: 'Action',
    key: 'action',
    render: (service) => hasBlocker(service.findings)
      ? <Inline gap="tight"><Icon name="danger" size="xs" tone="danger" /><Body size="sm">Resolve blocker</Body></Inline>
      : <Body size="sm" tone="accent">{classificationAction(service.classification)}</Body>,
  },
]

// A dependency is shown as the software it is; an application has no vendor,
// so it keeps the role icon. The mark never stands alone — it is always beside
// the service's own name.
function ServiceMark({ service }: { service: SourceServicePlan }) {
  const brand = service.classification === 'application' ? undefined : brandFor(service.name)
  return brand ? <BrandMark name={brand} size="sm" /> : <Icon name={classificationIcon(service.classification)} size="sm" />
}

function providerBrand(kind: SourceProviderKind) {
  return kind === 'github' ? 'github' as const : kind === 'gitlab' ? 'gitlab' as const : 'gitea' as const
}

function classificationIcon(classification: SourceClassification) {
  switch (classification) {
    case 'managed_data': return 'database' as const
    case 'shared_platform': return 'chart' as const
    case 'application': return 'package' as const
    default: return 'alert' as const
  }
}

function classificationType(classification: SourceClassification) {
  switch (classification) {
    case 'managed_data': return 'Database'
    case 'shared_platform': return 'Observability'
    case 'application': return 'Application'
    default: return 'Unsupported'
  }
}

// The Type column names what the thing IS in the source; the Classification
// chip names what SwarmOps will do with it. They agree for an application and
// deliberately differ for everything else.
function serviceKind(service: SourceServicePlan) {
  switch (service.classification) {
    case 'managed_data': return CACHE_ENGINES.has(service.name.toLowerCase()) ? 'Cache' : 'Database'
    case 'shared_platform': return 'Observability'
    case 'application': return 'Container'
    default: return 'Unsupported'
  }
}

const CACHE_ENGINES = new Set(['redis', 'valkey', 'memcached'])

function ClassificationBadge({ classification }: { classification: SourceClassification }) {
  const variant: BadgeVariant = classification === 'application' ? 'accent' : classification === 'managed_data' ? 'warning' : classification === 'shared_platform' ? 'info' : 'danger'
  return <Badge pill size="sm" tone="soft" variant={variant}>{classificationType(classification)}</Badge>
}

function connectionColumns(onEdit: (connection: SourceConnection) => void): TableColumn<SourceConnection>[] {
  return [
    { header: 'Connection', key: 'name', render: (connection) => <RecordLink meta={providerLabel(connection.kind)} title={connection.name} /> },
    { header: 'Verified account', key: 'account', render: (connection) => connection.account || 'Verified' },
    { header: 'Provider API', key: 'base', render: (connection) => <Mono>{connection.baseUrl}</Mono> },
    { header: 'Updated', key: 'updated', render: (connection) => formatDateTime(connection.updatedAt) },
    { header: 'Action', key: 'action', render: (connection) => <Button onClick={() => onEdit(connection)} size="sm" variant="secondary">Replace token</Button> },
  ]
}

function deploymentBlocks({ blockers, managerID, selectedService, selectedSlot, status }: { blockers: SourceFinding[]; managerID: string; selectedService?: SourceServicePlan; selectedSlot?: ApprovedWorkload; status: SourceStatus }) {
  const result: string[] = []
  if (!managerID) result.push('Select a connected Swarm manager before queuing a deployment.')
  if (!selectedService) result.push('Select one deployable source service.')
  if (!selectedSlot) result.push('Choose an approved application slot from the selected manager.')
  if (blockers.length) result.push('Resolve the selected service’s blocking discovery findings.')
  if (selectedService?.build?.required && !status.buildEnabled) result.push('Source builds are disabled on this controller.')
  if (selectedService?.build?.required && !status.imagePrefixConfigured) result.push('Configure an allow-listed source image prefix before building provider code.')
  return result
}

function selectSlot(name: string, slots: ApprovedWorkload[], setSlotName: (name: string) => void, setDomain: (domain: string) => void) {
  const slot = slots.find((candidate) => candidate.name === name)
  setSlotName(name)
  setDomain(slot?.domain ?? '')
}

function sourceServiceKey(service: SourceServicePlan) { return `${service.composePath}\u0000${service.service}` }
function sourceLocation(service: SourceServicePlan) { return service.composePath ? `${service.composePath} · ${service.service}` : service.service }
function hasBlocker(findings?: SourceFinding[]) { return Boolean(findings?.some((finding) => finding.level === 'blocker')) }
function classificationAction(classification: SourceClassification) {
  switch (classification) {
    case 'application': return 'Deploy'
    case 'managed_data': return 'Replace with managed'
    case 'shared_platform': return 'Use platform stack'
    default: return 'Manual redesign required'
  }
}
function providerLabel(kind: SourceProviderKind) { return kind === 'github' ? 'GitHub' : kind === 'gitlab' ? 'GitLab' : 'Gitea / Forgejo' }
function defaultConnectionName(kind: SourceProviderKind) { return kind === 'github' ? 'GitHub source' : kind === 'gitlab' ? 'GitLab source' : 'Gitea source' }
function providerBaseURLPlaceholder(kind: SourceProviderKind) { return kind === 'github' ? 'https://github.example.com/api/v3' : kind === 'gitlab' ? 'https://gitlab.example.com/api/v4' : 'https://git.example.com/api/v1' }
function providerBaseURLHint(kind: SourceProviderKind) { return kind === 'github' ? 'Leave blank for github.com. GitHub Enterprise usually ends in /api/v3.' : kind === 'gitlab' ? 'Leave blank for gitlab.com. Self-managed GitLab usually ends in /api/v4.' : 'Leave blank for gitea.com. Private Gitea and Forgejo usually end in /api/v1.' }
function sourceDomainPolicy(slot: ApprovedWorkload) { return slot.domainOptional ? `Optional${slot.domainSuffixes?.length ? ` under ${slot.domainSuffixes.join(', ')}` : ''}` : slot.domainSuffixes?.length ? `One hostname under ${slot.domainSuffixes.join(', ')}` : slot.domain || 'Internal only' }
function dynamicDomainHint(slot: ApprovedWorkload) { return slot.domainSuffixes?.length ? `Use one hostname under ${slot.domainSuffixes.join(' or ')}. Leave empty only when the slot permits no route.` : 'Leave empty to deploy without a public route.' }
function telemetryStacks(service: SourceServicePlan) { return service.metrics || service.tracing ? 'swarmops-observability' : '' }
function removalPhrase(connection?: SourceConnection) { return connection ? `REMOVE_SOURCE_${connection.id.slice(0, 8).toUpperCase()}` : '' }
function normalizeArray<T>(value: T[] | null | undefined) { return Array.isArray(value) ? value : [] }
function shortID(value: string) { return value.length > 12 ? `${value.slice(0, 12)}…` : value }
function shortDigest(value: string) { return value.length > 20 ? `${value.slice(0, 19)}…` : value }
function formatDateTime(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
function formatBytes(value: number) { if (!value) return '0 B'; const units = ['B', 'KiB', 'MiB', 'GiB']; const power = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1); return `${(value / 1024 ** power).toFixed(power > 1 ? 1 : 0)} ${units[power]}` }
function messageOf(reason: unknown) { return reason instanceof Error ? reason.message : 'Unexpected source deployment failure' }
