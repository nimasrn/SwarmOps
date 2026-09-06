import { useEffect, useState } from 'react'
import {
  Banner,
  Body,
  Button,
  CodeBlock,
  Columns,
  DataTable,
  EmptyState,
  Facts,
  Inline,
  Input,
  Label,
  Mono,
  Panel,
  RecordLink,
  Segmented,
  Select,
  Sheet,
  Spinner,
  Stack as Rows,
  Switch,
  useToast,
} from '@nim.zone/ui'
import type { TableColumn } from '@nim.zone/ui'
import { api } from '../../data/api'
import type { ApplicationSpec, ApplicationStatus, Command, DatabaseStatus, ResourcePlan } from '../../data/types'
import { useSelectedRecord } from '../../navigation/use-workspace'
import { shortID } from '../../lib/format'
import { messageOf } from '../../lib/errors'
import { Screen } from '../../components/screen'
import { StatusBadge } from '../../components/badges'
import { ConfirmPhrase } from '../../components/confirm-phrase'
import { EnvironmentEditor } from '../../components/environment-editor'
import { commandFailureText, commandOutcomeTitle, commandOutcomeTone, commandProgressText, isTerminal } from '../../lib/command-outcome'
import { environmentErrors, reservedDatabaseNames } from '../../lib/environment'
import { ApplicationDetailView } from './application-detail'

type Toast = ReturnType<typeof useToast>

/** A deployment builds and rolls out; the screen watches it for that long
    before handing it to Activity → Runs. */
const DEPLOY_FOLLOW_MS = 10 * 60 * 1000

const removalPhrase = (name: string) => `REMOVE_APPLICATION_${name.toUpperCase().replace(/-/g, '_')}`
const domainRemovalPhrase = (name: string) => `REMOVE_DOMAIN_${name.toUpperCase().replace(/-/g, '_')}`

/**
 * The products this console operates as one lifecycle.
 *
 * The screen used to open on a deployment FORM: nine fields, two panels, and
 * the list of what is actually running pushed below the fold. That is backwards
 * — an operator opens Applications far more often to look at one than to create
 * one — so the running applications are the screen, and every way of changing
 * them is a deliberate step from a row.
 *
 * `Redeploy` re-sends the spec the application is already running. It is the
 * cheapest real automation in the product: rolling a service after a base-image
 * or secret change previously meant retyping the whole spec from memory.
 */
export function ApplicationsPage({ commands, onDeployFromSource, onOpenRoutes, toast }: {
  commands: Command[]
  onDeployFromSource: () => void
  onOpenRoutes: () => void
  toast: Toast
}) {
  const [applications, setApplications] = useState<ApplicationStatus[] | null>(null)
  const [plans, setPlans] = useState<ResourcePlan[]>([])
  const [databases, setDatabases] = useState<DatabaseStatus[]>([])
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [preview, setPreview] = useState('')
  const [previewSpec, setPreviewSpec] = useState('')
  const [revisionSpec, setRevisionSpec] = useState<ApplicationSpec | null>(null)
  const [inspected, setInspected] = useSelectedRecord()
  const [query, setQuery] = useState('')
  const [stateFilter, setStateFilter] = useState('all')
  const [redeployFor, setRedeployFor] = useState<ApplicationStatus | null>(null)
  const [removeFor, setRemoveFor] = useState<ApplicationStatus | null>(null)
  const [composing, setComposing] = useState(false)
  const [domainFor, setDomainFor] = useState<ApplicationStatus | null>(null)
  const [domainValue, setDomainValue] = useState('')

  const [selected, setSelected] = useState('')
  const [image, setImage] = useState('')
  const [port, setPort] = useState('8080')
  const [healthPath, setHealthPath] = useState('/healthz')
  const [replicas, setReplicas] = useState('1')
  const [cpus, setCPUs] = useState('0.5')
  const [memoryMiB, setMemoryMiB] = useState('512')
  const [attached, setAttached] = useState<string[]>([])
  const [delivery, setDelivery] = useState<'secret' | 'env'>('secret')
  const [metrics, setMetrics] = useState(true)
  const [metricsPath, setMetricsPath] = useState('/metrics')
  const [tracing, setTracing] = useState(false)
  const [backend, setBackend] = useState('')
  const [environment, setEnvironment] = useState<Record<string, string>>({})
  const [progress, setProgress] = useState('')
  const [outcome, setOutcome] = useState<Command | null>(null)

  const refresh = async () => {
    const [apps, dbs, offered] = await Promise.all([
      api.applications(),
      api.databases(),
      api.applicationPlans().catch(() => null),
    ])
    const safeApps = Array.isArray(apps) ? apps : []
    setApplications(safeApps)
    setPlans(Array.isArray(offered?.plans) ? offered.plans : [])
    setDatabases(Array.isArray(dbs) ? dbs : [])
    if (!selected && safeApps.length > 0) setSelected(safeApps[0].spec.name)
  }
  useEffect(() => { void refresh().catch((reason) => setError(messageOf(reason))) }, [])

  const runningDatabases = databases.filter((database) => database.installed)

  // An attached engine delivers its URI under <ENGINE>_URL, or the _FILE
  // variant when it is mounted. Naming those here means a collision the
  // controller refuses is shown on the field rather than after the deploy.
  const reservedEnvironmentNames = reservedDatabaseNames(attached)
  const environmentProblems = environmentErrors(environment, reservedEnvironmentNames)

  const specOf = (): ApplicationSpec => ({
    ...(revisionSpec?.name === selected ? revisionSpec : {}),
    backend: backend || undefined,
    cpus: Number(cpus),
    databaseDelivery: delivery,
    databases: attached,
    domain: revisionSpec?.name === selected ? revisionSpec.domain : undefined,
    healthPath,
    image: image.trim(),
    memoryMiB: Number(memoryMiB),
    metrics,
    metricsPath,
    name: selected,
    port: Number(port),
    replicas: Number(replicas),
    resolver: revisionSpec?.name === selected ? revisionSpec.resolver : undefined,
    tracing,
    // Sent under the name the controller reads it by. The spec field carries
    // no JSON tag, so the wire name is the Go field name.
    Env: Object.keys(environment).length > 0 ? environment : undefined,
  })

  const plan = async () => {
    setPending(true)
    setError('')
    try {
      const proposed = specOf()
      const result = await api.planApplication(proposed)
      setPreview(result.compose)
      setPreviewSpec(JSON.stringify(proposed))
    } catch (reason) {
      setError(messageOf(reason))
    } finally {
      setPending(false)
    }
  }

  /**
   * Follow a queued deployment to whatever it becomes.
   *
   * The console used to toast the command ID and refresh: a deployment that
   * ended in needs_attention looked exactly like one that started serving, and
   * the controller's own reason was never read. It is read here, and shown.
   */
  const follow = async (command: Command, name: string) => {
    setOutcome(null)
    setProgress('')
    const final = isTerminal(command.state)
      ? command
      : await api.waitForCommand(command.id, DEPLOY_FOLLOW_MS, (update) => setProgress(commandProgressText(update)))
    setProgress('')
    await refresh()
    if (final.state === 'succeeded') {
      toast({ message: `${name} is deployed (${shortID(final.id)})`, tone: 'success' })
      return true
    }
    if (isTerminal(final.state)) {
      setOutcome(final)
      toast({ duration: 0, message: commandFailureText(final), tone: 'danger' })
      return false
    }
    // The screen stopped watching; the command did not.
    toast({ message: `${name} is still deploying as ${shortID(final.id)}. Watch it under Activity → Runs.`, tone: 'neutral' })
    return false
  }

  const deploy = async () => {
    setPending(true)
    setError('')
    setOutcome(null)
    try {
      const command = await api.deployApplication(specOf())
      toast({ message: `${selected} deployment queued (${shortID(command.id)})`, tone: 'success' })
      // The sheet stays open on a failure: it holds the fields the operator
      // would otherwise have to type again to correct one of them.
      if (await follow(command, selected)) setComposing(false)
    } catch (reason) {
      setError(messageOf(reason))
    } finally {
      setPending(false)
    }
  }

  const redeploy = async (status: ApplicationStatus) => {
    setPending(true)
    try {
      const command = await api.deployApplication(status.spec)
      setRedeployFor(null)
      toast({ message: `${status.spec.name} redeploy queued (${shortID(command.id)})`, tone: 'success' })
      await follow(command, status.spec.name)
    } catch (reason) {
      toast({ duration: 0, message: messageOf(reason), tone: 'danger' })
    } finally {
      setPending(false)
    }
  }

  const remove = async (status: ApplicationStatus) => {
    setPending(true)
    try {
      const command = await api.removeApplication(status.spec.name, removalPhrase(status.spec.name))
      setRemoveFor(null)
      toast({ message: `${status.spec.name} removal queued (${shortID(command.id)})`, tone: 'success' })
      await refresh()
    } catch (reason) {
      toast({ duration: 0, message: messageOf(reason), tone: 'danger' })
    } finally {
      setPending(false)
    }
  }

  const saveDomain = async (status: ApplicationStatus, value: string) => {
    setPending(true)
    try {
      const command = await api.setApplicationDomain(
        status.spec.name,
        value.trim(),
        // Empty means the controller's default resolver, which needs no DNS
        // credential. An application that already names one keeps it.
        value.trim() ? status.spec.resolver ?? '' : '',
        value.trim() ? '' : domainRemovalPhrase(status.spec.name),
      )
      toast({ message: `${status.spec.name} domain update queued (${shortID(command.id)})`, tone: 'success' })
      setDomainFor(null)
      await refresh()
    } catch (reason) {
      toast({ duration: 0, message: messageOf(reason), tone: 'danger' })
    } finally {
      setPending(false)
    }
  }

  const toggleDatabase = (engine: string, checked: boolean) => {
    setAttached((current) => checked ? [...current.filter((value) => value !== engine), engine] : current.filter((value) => value !== engine))
  }

  // The frame survives the wait. `LoadingScreen` is the full-viewport surface
  // that exists BEFORE the shell does; using it inside the workspace threw the
  // screen's own title away and centred a spinner in the whole page.
  if (!applications) {
    return (
      <Screen page="applications">
        <Panel>{error ? <Banner tone="danger" title="Applications are unavailable" action={<Button onClick={() => { setError(''); void refresh().catch((reason) => setError(messageOf(reason))) }}>Try again</Button>}>{error}</Banner> : <Spinner label="Reading applications" />}</Panel>
      </Screen>
    )
  }

  const inspectedStatus = applications.find((status) => status.spec.name === inspected)
  if (inspectedStatus) {
    return (
      <ApplicationDetailView
        commands={commands}
        onBack={() => setInspected('')}
        onDeploy={() => {
          const spec = inspectedStatus.spec
          setRevisionSpec(spec)
          setInspected(''); setSelected(spec.name); setImage(spec.image)
          setPort(String(spec.port)); setHealthPath(spec.healthPath ?? ''); setReplicas(String(spec.replicas))
          setCPUs(String(spec.cpus)); setMemoryMiB(String(spec.memoryMiB)); setAttached(spec.databases ?? [])
          setDelivery(spec.databaseDelivery ?? 'secret'); setMetrics(spec.metrics); setMetricsPath(spec.metricsPath ?? '/metrics')
          setTracing(spec.tracing ?? false); setBackend(spec.backend ?? ''); setEnvironment(spec.Env ?? {})
          setPreview(''); setComposing(true)
        }}
        onOpenRoutes={onOpenRoutes}
        status={inspectedStatus}
      />
    )
  }
  if (inspected) return <Screen page="applications"><EmptyState title="Application not found" description={`No application named ${inspected} is present in this cluster snapshot.`} actions={<Button onClick={() => setInspected('')}>Back to applications</Button>} /></Screen>

  const serving = applications.filter((status) => status.state === 'serving')
  const degraded = applications.filter((status) => status.state === 'stopped')
  // An application that never started is not "deployed but down": nothing was
  // ever running to go down. It is kept, and named, so it can be read and
  // fixed rather than disappearing the moment its first deployment failed.
  const failed = applications.filter((status) => status.state === 'failed')
  const published = applications.filter((status) => Boolean(status.spec.domain))
  // Every application's hostname can be changed or withdrawn. Nothing declares
  // one in advance any more, so nothing can forbid changing it either.
  const editableDomain = (_status: ApplicationStatus) => true

  const columns: TableColumn<ApplicationStatus>[] = [
    { header: 'Application', key: 'name', render: (status) => <RecordLink meta={status.stack} onClick={() => setInspected(status.spec.name)} title={status.spec.name} /> },
    { header: 'Address', key: 'url', render: (status) => status.url ? <a href={status.url} rel="noreferrer" target="_blank">{status.url}</a> : 'Internal only' },
    { header: 'Image', key: 'image', render: (status) => <Mono>{status.spec.image}</Mono> },
    { header: 'Databases', key: 'databases', render: (status) => (status.spec.databases ?? []).join(', ') || 'None' },
    { header: 'Tasks', key: 'tasks', render: (status) => <StatusBadge health={status.state === 'serving' ? 'healthy' : status.state === 'failed' ? 'unhealthy' : 'degraded'} label={status.state === 'serving' ? `${status.runningTasks} running` : status.state === 'failed' ? 'Failed to start' : 'Stopped'} /> },
    {
      header: 'Action',
      key: 'action',
      render: (status) => (
        <Inline gap="tight">
          <Button disabled={pending} onClick={() => setRedeployFor(status)} size="sm" variant="secondary">Redeploy…</Button>
          {editableDomain(status)
            ? <Button onClick={() => { setDomainFor(status); setDomainValue(status.spec.domain ?? '') }} size="sm" variant="ghost">Domain</Button>
            : null}
          <Button onClick={() => setInspected(status.spec.name)} size="sm" variant="ghost">Open</Button>
          <Button disabled={pending} onClick={() => setRemoveFor(status)} size="sm" variant="ghost">Remove…</Button>
        </Inline>
      ),
    },
  ]

  return (
    <Screen
      about="SwarmOps renders the Compose, the Traefik route, the health probe, and the database wiring, then puts its own output through the same policy as hand-written Compose."
      actions={
        <Inline>
          <Button iconStart="play" onClick={onDeployFromSource} variant="accent">Deploy from source</Button>
          <Button iconStart="package" onClick={() => setComposing(true)} variant="secondary">Deploy a pushed image…</Button>
        </Inline>
      }
      insights={[
        { hint: serving.length === applications.length ? 'Every deployed application has a running task' : 'Applications with at least one running task', icon: 'layers', label: 'Serving', tone: applications.length && serving.length === applications.length ? 'success' : 'warning', value: `${serving.length} / ${applications.length}` },
        { hint: degraded.length ? 'Started at some point, with no running task now' : 'No started application is down', icon: 'alert', label: 'Stopped', tone: degraded.length ? 'danger' : 'success', value: String(degraded.length) },
        { hint: failed.length ? 'Never started; open the run that explains why' : 'Every application has started at least once', icon: 'alert', label: 'Failed to start', tone: failed.length ? 'danger' : 'success', value: String(failed.length) },
        { hint: published.length ? 'Reachable on a public hostname through the gateway' : 'Every application is internal only', icon: 'globe', label: 'Publicly routed', onOpen: onOpenRoutes, value: String(published.length) },
        { hint: 'Applications SwarmOps has deployed on this controller', icon: 'shield', label: 'Deployed', tone: 'neutral', value: String(applications.length) },
      ]}
      page="applications"
      width="full"
    >
      {error && !composing ? <Banner tone="danger" title="Application data could not be refreshed">{error}</Banner> : null}
      <Inline>
        <Input label="Find an application" placeholder="Name, image, or domain" value={query} onChange={(event) => setQuery(event.target.value)} />
        <Select label="Application state" value={stateFilter} onChange={(event) => setStateFilter(event.target.value)} options={[{label: 'All states', value: 'all'}, {label: 'Serving', value: 'serving'}, {label: 'Failed to start', value: 'failed'}, {label: 'Needs attention', value: 'attention'}]} />
      </Inline>
      <Panel caption={`${applications.length} applications in this cluster`} flush title="Applications" variant="plain">
        <DataTable
          caption="Rendered applications"
          columns={columns}
          empty={applications.length ? <EmptyState title="No matching applications" description="Try another name or clear the state filter." actions={<Button onClick={() => { setQuery(''); setStateFilter('all') }}>Clear filters</Button>} /> : <EmptyState actions={<Button onClick={onDeployFromSource} variant="accent">Deploy from source</Button>} description="Point SwarmOps at a repository and it will build, render, route, and roll out the result." icon="layers" title="No applications yet" />}
          rowKey={(status) => status.spec.name}
          rows={applications.filter((status) => `${status.spec.name} ${status.spec.image} ${status.spec.domain ?? ''}`.toLowerCase().includes(query.toLowerCase()) && (stateFilter === 'all'
            || (stateFilter === 'serving' && status.state === 'serving' && status.runningTasks >= (status.spec.replicas ?? 1))
            || (stateFilter === 'failed' && status.state === 'failed')
            || (stateFilter === 'attention' && (status.state !== 'serving' || status.runningTasks < (status.spec.replicas ?? 1)))))}
        />
      </Panel>

      <Sheet open={Boolean(redeployFor)} onClose={() => { if (!pending) setRedeployFor(null) }} title="Review redeployment">
        {redeployFor ? <Rows><Body>This queues a rolling deployment of {redeployFor.spec.name} using its current specification. Tasks may restart; the request does not prove the rollout succeeded.</Body><Facts items={[{label: 'Application', value: redeployFor.spec.name}, {label: 'Image', value: <Mono>{redeployFor.spec.image}</Mono>}, {label: 'Desired replicas', value: redeployFor.spec.replicas}]} /><Button loading={pending} disabled={pending} onClick={() => void redeploy(redeployFor)} variant="accent">Queue redeployment</Button></Rows> : null}
      </Sheet>
      <Sheet open={Boolean(removeFor)} onClose={() => { if (!pending) setRemoveFor(null) }} title="Remove application">
        {removeFor ? <ConfirmPhrase action={`Remove ${removeFor.spec.name}`} consequence={`${removeFor.spec.name} stops serving. Its stack and route are withdrawn; named volumes are retained.`} busy={pending} onConfirm={() => void remove(removeFor)} phrase={removalPhrase(removeFor.spec.name)} /> : null}
      </Sheet>

      {/* Deploying a pushed image is the manual path. It is a sheet because it
          is a task with a beginning and an end, not a permanent part of the
          screen an operator reads to find out what is running. */}
      <Sheet closeLabel="Close the deployment form" onClose={() => setComposing(false)} open={composing} title="Deploy a pushed image">
        <Rows>
          <Columns>
            <Rows>
              <Input
                hint="The application name, and the stack it deploys into. A name already deployed is redeployed."
                label="Application name"
                onChange={(event) => setSelected(event.target.value)}
                placeholder="invoices"
                value={selected}
              />
              <Input hint="An already-pushed, immutable image tag. SwarmOps deploys images; it does not build here." label="Image" onChange={(event) => setImage(event.target.value)} placeholder="ghcr.io/org/app:2026.08.25" value={image} />
              <Columns>
                <Input label="Container port" min="1" onChange={(event) => setPort(event.target.value)} type="number" value={port} />
                <Input hint="Probed inside the container; the image needs a shell with wget or curl." label="Health path" onChange={(event) => setHealthPath(event.target.value)} value={healthPath} />
              </Columns>
              {/* Picking a size fills the two numbers below rather than
                  hiding them: a size that is not offered is stated outright. */}
              <Select
                label="Size"
                onChange={(event) => {
                  const chosen = plans.find((candidate) => candidate.name === event.target.value)
                  if (!chosen) return
                  setCPUs(String(chosen.cpuCores))
                  setMemoryMiB(String(chosen.memoryMiB))
                }}
                options={plans.map((candidate) => ({ label: `${candidate.name} · ${candidate.cpuCores} vCPU · ${candidate.memoryMiB} MiB`, value: candidate.name }))}
                placeholder="Choose a size"
                value={plans.find((candidate) => String(candidate.cpuCores) === cpus && String(candidate.memoryMiB) === memoryMiB)?.name ?? ''}
              />
              <Columns>
                <Input label="Replicas" min="1" onChange={(event) => setReplicas(event.target.value)} type="number" value={replicas} />
                <Input label="vCPU" min="0.1" onChange={(event) => setCPUs(event.target.value)} step="0.1" type="number" value={cpus} />
                <Input label="Memory (MiB)" min="64" onChange={(event) => setMemoryMiB(event.target.value)} type="number" value={memoryMiB} />
              </Columns>
            </Rows>

            <Rows>
              {runningDatabases.length === 0
                ? <Body size="sm">No managed database is running. Deploy one under Workloads → Managed databases to attach it here.</Body>
                : runningDatabases.map((database) => (
                  <Switch
                    checked={attached.includes(database.engine)}
                    description={`Injects the generated connection URI for ${database.host}:${database.port}.`}
                    key={database.engine}
                    onChange={(event) => toggleDatabase(database.engine, event.target.checked)}
                  >
                    Attach {database.displayName}
                  </Switch>
                ))}
              {attached.length > 0 ? (
                <Segmented
                  fullWidth
                  label="Deliver the connection URI as"
                  onChange={(value) => setDelivery(value)}
                  options={[
                    { label: 'Mounted secret file', value: 'secret' as const },
                    { label: 'Environment variable', value: 'env' as const },
                  ]}
                  value={delivery}
                />
              ) : null}
              {attached.length > 0 && delivery === 'env' ? (
                <Banner tone="warning" title="The credential becomes readable">
                  An environment variable is visible to anyone who can run <Mono>docker service inspect</Mono> on the cluster. The mounted file is not.
                </Banner>
              ) : null}
              <Select
                hint="A frontend receives its backend's in-cluster and public URLs."
                label="Backend application"
                onChange={(event) => setBackend(event.target.value)}
                options={[{ label: 'None', value: '' }, ...applications.filter((status) => status.spec.name !== selected).map((status) => ({ label: status.spec.name, value: status.spec.name }))]}
                value={backend}
              />
              <Switch checked={metrics} description="Prometheus discovers the application and starts scraping it without a configuration change." onChange={(event) => setMetrics(event.target.checked)}>Collect metrics</Switch>
              {metrics ? <Input label="Metrics path" onChange={(event) => setMetricsPath(event.target.value)} value={metricsPath} /> : null}
              <Switch checked={tracing} description="Connects the rendered application to the shared Jaeger OpenTelemetry endpoint; no provider Compose telemetry service is deployed." onChange={(event) => setTracing(event.target.checked)}>Send traces to shared Jaeger</Switch>
              <Rows gap="tight">
                <Label>Environment</Label>
                <Body size="sm" tone="muted">Set on the service itself. A managed database delivers its own connection URI and does not belong here.</Body>
                <EnvironmentEditor onChange={setEnvironment} reserved={reservedEnvironmentNames} value={environment} />
              </Rows>
            </Rows>
          </Columns>

          {environmentProblems.length > 0 ? (
            <Banner tone="warning" title="The environment is not deployable yet">{environmentProblems.join(' ')}</Banner>
          ) : null}
          {pending && progress ? <Banner tone="info" title="The deployment is running">{progress}. This screen watches it for ten minutes; the command outlives the screen either way.</Banner> : null}
          {outcome ? <Banner tone={commandOutcomeTone(outcome)} title={commandOutcomeTitle(outcome)}>{commandFailureText(outcome)}</Banner> : null}
          {error ? <Banner tone="danger" title="This application cannot be deployed">{error}</Banner> : null}
          <Inline>
            <Button disabled={pending || !selected || !image || environmentProblems.length > 0} loading={pending} onClick={() => void plan()} variant="secondary">Preview the rendered Compose</Button>
            <Button disabled={pending || !selected || !image || !preview || previewSpec !== JSON.stringify(specOf())} loading={pending} onClick={() => void deploy()} variant="accent">Deploy reviewed application</Button>
          </Inline>
          {preview && previewSpec === JSON.stringify(specOf()) ? <CodeBlock label="Reviewed Compose for the current fields" wrap>{preview}</CodeBlock> : <Body size="sm" tone="muted">Preview the current configuration before deploying. Changing a field requires a new preview.</Body>}
        </Rows>
      </Sheet>

      <Sheet
        closeLabel="Close the domain editor"
        onClose={() => setDomainFor(null)}
        open={Boolean(domainFor)}
        title={domainFor ? `Public hostname for ${domainFor.spec.name}` : 'Public hostname'}
      >
        {domainFor ? (
          <DomainEditor
            application={domainFor}
            onSave={(value) => void saveDomain(domainFor, value)}
            pending={pending}
            setValue={setDomainValue}
            value={domainValue}
          />
        ) : null}
      </Sheet>
    </Screen>
  )
}

function DomainEditor({ application, onSave, pending, setValue, value }: {
  application: ApplicationStatus
  onSave: (value: string) => void
  pending: boolean
  setValue: (value: string) => void
  value: string
}) {
  return (
    <Rows>
      <Facts items={[
        { label: 'Current domain', value: application.spec.domain || 'Internal only' },
        { label: 'Certificate resolver', value: application.spec.resolver || 'http (default)' },
      ]} />
      <Input
        hint="Any hostname you control. Leave the field empty and confirm below to withdraw the public route."
        label="Domain"
        onChange={(event) => setValue(event.target.value)}
        placeholder="app.example.com"
        value={value}
      />
      {value.trim() ? (
        <Button disabled={pending} loading={pending} onClick={() => onSave(value)} variant="accent">Queue domain assignment</Button>
      ) : (
        <ConfirmPhrase
          action="Queue domain removal"
          consequence={`${application.spec.name} stops answering on ${application.spec.domain || 'its public hostname'}. The application and its internal service stay deployed.`}
          busy={pending}
          onConfirm={() => onSave('')}
          phrase={domainRemovalPhrase(application.spec.name)}
        />
      )}
    </Rows>
  )
}
