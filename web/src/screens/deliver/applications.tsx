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
import type { ApplicationSpec, ApplicationStatus, ApprovedWorkload, DatabaseStatus } from '../../data/types'
import { shortID } from '../../lib/format'
import { messageOf } from '../../lib/errors'
import { Screen } from '../../components/screen'
import { StatusBadge } from '../../components/badges'
import { ConfirmPhrase } from '../../components/confirm-phrase'
import { ApplicationDetailView } from './application-detail'

type Toast = ReturnType<typeof useToast>

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
export function ApplicationsPage({ onDeployFromSource, onOpenRoutes, toast }: {
  onDeployFromSource: () => void
  onOpenRoutes: () => void
  toast: Toast
}) {
  const [applications, setApplications] = useState<ApplicationStatus[] | null>(null)
  const [approved, setApproved] = useState<ApprovedWorkload[]>([])
  const [databases, setDatabases] = useState<DatabaseStatus[]>([])
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [preview, setPreview] = useState('')
  const [inspected, setInspected] = useState('')
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

  const refresh = async () => {
    const [apps, slots, dbs] = await Promise.all([api.applications(), api.approvedApplications(), api.databases()])
    const safeApps = Array.isArray(apps) ? apps : []
    const safeSlots = Array.isArray(slots) ? slots : []
    setApplications(safeApps)
    setApproved(safeSlots)
    setDatabases(Array.isArray(dbs) ? dbs : [])
    if (!selected && safeSlots.length > 0) setSelected(safeSlots[0].name)
  }
  useEffect(() => { void refresh().catch((reason) => setError(messageOf(reason))) }, [])

  const slot = approved.find((workload) => workload.name === selected)
  const runningDatabases = databases.filter((database) => database.installed)

  const specOf = (): ApplicationSpec => ({
    backend: backend || undefined,
    cpus: Number(cpus),
    databaseDelivery: delivery,
    databases: attached,
    domain: slot?.domain,
    healthPath,
    image: image.trim(),
    memoryMiB: Number(memoryMiB),
    metrics,
    metricsPath,
    name: selected,
    port: Number(port),
    replicas: Number(replicas),
    resolver: slot?.resolver,
    tracing,
  })

  const plan = async () => {
    setPending(true)
    setError('')
    try {
      setPreview((await api.planApplication(specOf())).compose)
    } catch (reason) {
      setError(messageOf(reason))
    } finally {
      setPending(false)
    }
  }

  const deploy = async () => {
    setPending(true)
    setError('')
    try {
      const command = await api.deployApplication(specOf())
      toast({ message: `${selected} deployment queued (${shortID(command.id)})`, tone: 'success' })
      setComposing(false)
      await refresh()
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
      toast({ message: `${status.spec.name} redeploy queued (${shortID(command.id)})`, tone: 'success' })
      await refresh()
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
      toast({ message: `${status.spec.name} removal queued (${shortID(command.id)})`, tone: 'success' })
      await refresh()
    } catch (reason) {
      toast({ duration: 0, message: messageOf(reason), tone: 'danger' })
    } finally {
      setPending(false)
    }
  }

  const saveDomain = async (status: ApplicationStatus, value: string) => {
    const policy = approved.find((workload) => workload.name === status.spec.name)
    setPending(true)
    try {
      const command = await api.setApplicationDomain(
        status.spec.name,
        value.trim(),
        value.trim() ? policy?.resolver ?? '' : '',
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
        <Panel><Spinner label="Reading applications" /></Panel>
      </Screen>
    )
  }

  const inspectedStatus = applications.find((status) => status.spec.name === inspected)
  if (inspectedStatus) {
    return (
      <ApplicationDetailView
        onBack={() => setInspected('')}
        onDeploy={() => { setInspected(''); setSelected(inspectedStatus.spec.name); setImage(inspectedStatus.spec.image); setComposing(true) }}
        onOpenRoutes={onOpenRoutes}
        status={inspectedStatus}
      />
    )
  }

  const serving = applications.filter((status) => status.deployed && status.runningTasks > 0)
  const degraded = applications.filter((status) => status.deployed && status.runningTasks === 0)
  const published = applications.filter((status) => Boolean(status.spec.domain))
  const editableDomain = (status: ApplicationStatus) => {
    const policy = approved.find((workload) => workload.name === status.spec.name)
    return Boolean(policy?.domainOptional || policy?.domainSuffixes?.length)
  }

  const columns: TableColumn<ApplicationStatus>[] = [
    { header: 'Application', key: 'name', render: (status) => <RecordLink meta={status.stack} onClick={() => setInspected(status.spec.name)} title={status.spec.name} /> },
    { header: 'Address', key: 'url', render: (status) => status.url ? <a href={status.url} rel="noreferrer" target="_blank">{status.url}</a> : 'Internal only' },
    { header: 'Image', key: 'image', render: (status) => <Mono>{status.spec.image}</Mono> },
    { header: 'Databases', key: 'databases', render: (status) => (status.spec.databases ?? []).join(', ') || 'None' },
    { header: 'Tasks', key: 'tasks', render: (status) => <StatusBadge health={status.runningTasks > 0 ? 'healthy' : status.deployed ? 'degraded' : 'unknown'} label={status.deployed ? `${status.runningTasks} running` : 'Not deployed'} /> },
    {
      header: 'Action',
      key: 'action',
      render: (status) => (
        <Inline gap="tight">
          <Button disabled={pending} onClick={() => void redeploy(status)} size="sm" variant="secondary">Redeploy</Button>
          {editableDomain(status)
            ? <Button onClick={() => { setDomainFor(status); setDomainValue(status.spec.domain ?? '') }} size="sm" variant="ghost">Domain</Button>
            : null}
          <Button onClick={() => setInspected(status.spec.name)} size="sm" variant="ghost">Open</Button>
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
          <Button disabled={!approved.length} iconStart="package" onClick={() => setComposing(true)} variant="secondary">Deploy a pushed image…</Button>
        </Inline>
      }
      insights={[
        { hint: serving.length === applications.length ? 'Every deployed application has a running task' : 'Applications with at least one running task', icon: 'layers', label: 'Serving', tone: applications.length && serving.length === applications.length ? 'success' : 'warning', value: `${serving.length} / ${applications.length}` },
        { hint: degraded.length ? 'Deployed, but Swarm reports no running task' : 'No deployed application is down', icon: 'alert', label: 'Deployed but down', tone: degraded.length ? 'danger' : 'success', value: String(degraded.length) },
        { hint: published.length ? 'Reachable on a public hostname through the gateway' : 'Every application is internal only', icon: 'globe', label: 'Publicly routed', onOpen: onOpenRoutes, value: String(published.length) },
        { hint: approved.length ? 'Reviewed slots this controller may deploy into' : 'No slot is approved in the platform manifest', icon: 'shield', label: 'Approved slots', tone: approved.length ? 'neutral' : 'warning', value: String(approved.length) },
      ]}
      page="applications"
      width="full"
    >
      {approved.length === 0 ? (
        <Banner tone="warning" title="No application slots are approved">
          Add a workload with <Mono>profile: application</Mono>, a domain, a resolver, and a resource budget to the reviewed platform manifest, then reconnect.
        </Banner>
      ) : null}

      <Panel caption={`${applications.length} deployed`} flush title="Applications">
        <DataTable
          caption="Rendered applications"
          columns={columns}
          empty={<EmptyState actions={<Button onClick={onDeployFromSource} variant="accent">Deploy from source</Button>} description="Point SwarmOps at a repository and it will build, render, route, and roll out the result." icon="layers" title="No applications yet" />}
          rowKey={(status) => status.spec.name}
          rows={applications}
        />
      </Panel>

      {applications.length ? (
        <Panel description="Removal stops the only process serving this application. The rendered stack and its route are withdrawn; named volumes are left in place." title="Remove an application">
          <Columns>
            {applications.map((status) => (
              <ConfirmPhrase
                action={`Remove ${status.spec.name}`}
                consequence={`${status.spec.name} stops serving${status.spec.domain ? ` and ${status.spec.domain} stops resolving to it` : ''}. Its rendered stack is withdrawn from Swarm.`}
                key={status.spec.name}
                busy={pending}
                onConfirm={() => void remove(status)}
                phrase={removalPhrase(status.spec.name)}
              />
            ))}
          </Columns>
        </Panel>
      ) : null}

      {/* Deploying a pushed image is the manual path. It is a sheet because it
          is a task with a beginning and an end, not a permanent part of the
          screen an operator reads to find out what is running. */}
      <Sheet closeLabel="Close the deployment form" onClose={() => setComposing(false)} open={composing} title="Deploy a pushed image">
        <Rows>
          <Columns>
            <Rows>
              <Select
                label="Approved slot"
                onChange={(event) => setSelected(event.target.value)}
                options={approved.map((workload) => ({ label: workload.domain ? `${workload.name} — ${workload.domain}` : workload.name, value: workload.name }))}
                value={selected}
              />
              {slot ? (
                <Facts items={[
                  { label: 'Domain', value: slot.domain || 'Internal only' },
                  { label: 'Certificate resolver', value: slot.resolver || 'None configured' },
                  { label: 'Budget', value: `${slot.cpuCores} vCPU · ${slot.memoryMiB} MiB` },
                ]} />
              ) : null}
              <Input hint="An already-pushed, immutable image tag. SwarmOps deploys images; it does not build here." label="Image" onChange={(event) => setImage(event.target.value)} placeholder="ghcr.io/org/app:2026.08.25" value={image} />
              <Columns>
                <Input label="Container port" min="1" onChange={(event) => setPort(event.target.value)} type="number" value={port} />
                <Input hint="Probed inside the container; the image needs a shell with wget or curl." label="Health path" onChange={(event) => setHealthPath(event.target.value)} value={healthPath} />
              </Columns>
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
            </Rows>
          </Columns>

          {error ? <Banner tone="danger" title="This application cannot be deployed">{error}</Banner> : null}
          <Inline>
            <Button disabled={pending || !selected || !image} loading={pending} onClick={() => void plan()} variant="secondary">Preview the rendered Compose</Button>
            <Button disabled={pending || !selected || !image} loading={pending} onClick={() => void deploy()} variant="accent">Deploy application</Button>
          </Inline>
          {preview ? <CodeBlock label="Exactly what will be deployed" wrap>{preview}</CodeBlock> : null}
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
            policy={approved.find((workload) => workload.name === domainFor.spec.name)}
            setValue={setDomainValue}
            value={domainValue}
          />
        ) : null}
      </Sheet>
    </Screen>
  )
}

function DomainEditor({ application, onSave, pending, policy, setValue, value }: {
  application: ApplicationStatus
  onSave: (value: string) => void
  pending: boolean
  policy?: ApprovedWorkload
  setValue: (value: string) => void
  value: string
}) {
  return (
    <Rows>
      <Facts items={[
        { label: 'Current domain', value: application.spec.domain || 'Internal only' },
        { label: 'Certificate resolver', value: policy?.resolver || 'None configured' },
        { label: 'Allowed policy', value: policy?.domainSuffixes?.length ? `One hostname under ${policy.domainSuffixes.join(', ')}` : 'Optional route' },
      ]} />
      <Input
        hint={policy?.domainSuffixes?.length
          ? `Use one hostname under ${policy.domainSuffixes.join(' or ')}.`
          : 'Leave the field empty and confirm below to withdraw the public route.'}
        label="Domain"
        onChange={(event) => setValue(event.target.value)}
        placeholder={policy?.domainSuffixes?.[0] || 'app.example.com'}
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
