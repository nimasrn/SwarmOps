import {
  Accordion,
  Badge,
  Banner,
  Body,
  BrandMark,
  brandFor,
  Button,
  Columns,
  DataTable,
  EmptyState,
  Icon,
  Inline,
  Label,
  Mono,
  Panel,
  RecordLink,
  Select,
  Stack as Rows,
} from '@nim.zone/ui'
import type { BadgeVariant, TableColumn } from '@nim.zone/ui'
import type {
  ApprovedWorkload,
  SourceClassification,
  SourceConnection,
  SourceEvidenceFile,
  SourceFinding,
  SourcePlan,
  SourceProviderKind,
  SourceServicePlan,
  SourceStatus,
} from '../../../data/types'
import { formatBytes, formatDateTime, shortDigest, shortID } from '../../../lib/format'

/**
 * The shared reading vocabulary of the source flow: how a discovered service is
 * named, marked, classified, and blocked.
 *
 * They live apart from the screen because the plan panel and the discovery
 * table both draw them, and because "what this classification MEANS" is a rule
 * rather than a rendering decision — a service SwarmOps calls a cache has to be
 * called a cache in both places or the screen contradicts itself.
 */

export const DOMAIN_FIELD_ID = 'swarmops-source-domain'
export const TELEMETRY_FIELD_ID = 'swarmops-source-metrics'

export interface SourceDraft {
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
  /** Which way into the flow the operator was using. Optional so a draft
      written before the flow was persisted still restores. */
  source?: 'kubernetes' | 'repository'
}

export function draftKey(managerID: string) {
  return `swarmops.source-draft.${managerID}`
}

export function maskedToken(connection: SourceConnection) {
  const prefix = connection.kind === 'github' ? 'ghp_' : connection.kind === 'gitlab' ? 'glpat-' : 'gta_'
  return `${prefix}${'•'.repeat(28)}`
}

// The provider names a container; the platform names an engine. A row that
// says "postgres" is naming the source service, and the whole point of this
// rail is that the source service is not what gets deployed.
export function DependencyMark({ fallback, name }: { fallback: 'database' | 'layers'; name: string }) {
  const brand = brandFor(name)
  return brand ? <BrandMark name={brand} size="sm" /> : <Icon name={fallback} size="sm" />
}

// Same rule as an engine: the platform names the product, not the container.
export function stackName(stack: string) {
  const stacks: Record<string, string> = { alertmanager: 'Alertmanager', alloy: 'Source logging collector', cadvisor: 'cAdvisor', fluentd: 'Source logging collector', 'fluent-bit': 'Source logging collector', jaeger: 'Jaeger', loki: 'Source logging collector', promtail: 'Source logging collector', 'node-exporter': 'Node exporter', prometheus: 'Prometheus' }
  return stacks[stack.toLowerCase()] ?? stack
}

export function engineName(database: string) {
  const engines: Record<string, string> = { mongo: 'MongoDB', mongodb: 'MongoDB', postgres: 'PostgreSQL', postgresql: 'PostgreSQL', redis: 'Redis', valkey: 'Valkey' }
  return engines[database.toLowerCase()] ?? database
}

export function providerOrigin(baseUrl: string) {
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
export function directoryCount(plan: SourcePlan) {
  const directories = new Set<string>()
  for (const file of [...plan.composeFiles, ...plan.dockerfiles]) {
    const slash = file.path.lastIndexOf('/')
    directories.add(slash === -1 ? '.' : file.path.slice(0, slash))
  }
  return directories.size
}


export function DiscoveryEvidence({ onChooseService, plan, selectedService, serviceKey }: { onChooseService: (key: string) => void; plan: SourcePlan; selectedService?: SourceServicePlan; serviceKey: string }) {
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

export function EvidenceTable({ empty, files }: { empty: string; files: SourceEvidenceFile[] }) {
  const columns: TableColumn<SourceEvidenceFile>[] = [
    { header: 'Path', key: 'path', render: (file) => <Mono>{file.path}</Mono> },
    { header: 'Size', key: 'size', numeric: true, render: (file) => formatBytes(file.size) },
    { header: 'Evidence digest', key: 'digest', render: (file) => <Mono>{shortDigest(file.digest)}</Mono> },
  ]
  return <DataTable caption="Source file evidence" columns={columns} empty={<EmptyState description={empty} icon="document" title="No file evidence" />} rowKey={(file) => file.path} rows={files} />
}

export const serviceColumns: TableColumn<SourceServicePlan>[] = [
  { header: 'Service', key: 'service', render: (service) => <Inline><ServiceMark service={service} />{service.name}</Inline> },
  { header: 'Type', key: 'type', render: (service) => serviceKind(service) },
  { header: 'Source location', key: 'location', render: (service) => <Mono>{service.composePath || 'standalone Dockerfile'}</Mono> },
  { header: 'Classification', key: 'classification', render: (service) => <ClassificationBadge classification={service.classification} /> },
  {
    // A blocked row says WHY it is blocked, not that it is. An operator in the
    // middle of a deployment should never have to leave discovery to read the
    // one sentence that decides whether this service can ship.
    header: 'Action',
    key: 'action',
    render: (service) => {
      const blockers = blockerFindings(service.findings)
      return blockers.length > 0
        ? (
          <Rows gap="tight">
            {blockers.map((finding) => (
              <Inline gap="tight" key={`${finding.code}/${finding.subject ?? ''}`}>
                <Icon name="danger" size="xs" tone="danger" />
                <Body size="sm">{finding.message}{finding.subject ? <> <Mono>{finding.subject}</Mono></> : null}</Body>
              </Inline>
            ))}
          </Rows>
        )
        : <Body size="sm" tone="accent">{classificationAction(service.classification)}</Body>
    },
  },
]

// A dependency is shown as the software it is; an application has no vendor,
// so it keeps the role icon. The mark never stands alone — it is always beside
// the service's own name.
export function ServiceMark({ service }: { service: SourceServicePlan }) {
  const brand = service.classification === 'application' ? undefined : brandFor(service.name)
  return brand ? <BrandMark name={brand} size="sm" /> : <Icon name={classificationIcon(service.classification)} size="sm" />
}

export function providerBrand(kind: SourceProviderKind) {
  return kind === 'github' ? 'github' as const : kind === 'gitlab' ? 'gitlab' as const : 'gitea' as const
}

export function classificationIcon(classification: SourceClassification) {
  switch (classification) {
    case 'managed_data': return 'database' as const
    case 'shared_platform': return 'chart' as const
    case 'application': return 'package' as const
    default: return 'alert' as const
  }
}

export function classificationType(classification: SourceClassification) {
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
export function serviceKind(service: SourceServicePlan) {
  switch (service.classification) {
    case 'managed_data': return CACHE_ENGINES.has(service.name.toLowerCase()) ? 'Cache' : 'Database'
    case 'shared_platform': return 'Observability'
    case 'application': return 'Container'
    default: return 'Unsupported'
  }
}

export const CACHE_ENGINES = new Set(['redis', 'valkey', 'memcached'])

export function ClassificationBadge({ classification }: { classification: SourceClassification }) {
  const variant: BadgeVariant = classification === 'application' ? 'accent' : classification === 'managed_data' ? 'warning' : classification === 'shared_platform' ? 'info' : 'danger'
  return <Badge pill size="sm" tone="soft" variant={variant}>{classificationType(classification)}</Badge>
}

export function connectionColumns(onEdit: (connection: SourceConnection) => void): TableColumn<SourceConnection>[] {
  return [
    { header: 'Connection', key: 'name', render: (connection) => <RecordLink meta={providerLabel(connection.kind)} title={connection.name} /> },
    { header: 'Verified account', key: 'account', render: (connection) => connection.account || 'Verified' },
    { header: 'Provider API', key: 'base', render: (connection) => <Mono>{connection.baseUrl}</Mono> },
    { header: 'Updated', key: 'updated', render: (connection) => formatDateTime(connection.updatedAt) },
    { header: 'Action', key: 'action', render: (connection) => <Button onClick={() => onEdit(connection)} size="sm" variant="secondary">Replace token</Button> },
  ]
}

export function deploymentBlocks({ blockers, managerID, selectedService, selectedSlot, status, unmanaged }: { blockers: SourceFinding[]; managerID: string; selectedService?: SourceServicePlan; selectedSlot?: ApprovedWorkload; status: SourceStatus; unmanaged?: boolean }) {
  const result: string[] = []
  if (!managerID) result.push('Select a connected Swarm manager before queuing a deployment.')
  if (!selectedService) result.push('Select one deployable source service.')
  if (!selectedSlot) result.push(unmanaged ? 'Name the application this deployment becomes.' : 'Choose an approved application slot from the selected manager.')
  if (blockers.length) result.push('Resolve the selected service’s blocking discovery findings.')
  if (selectedService?.build?.required && !status.buildEnabled) result.push('Source builds are disabled on this controller.')
  return result
}

// A slot with one fixed hostname owns it outright. When the slot instead
// permits a hostname under reviewed suffixes, the host the repository already
// routes itself on is a better proposal than an empty field: the operator
// still reviews it, and platform admission still checks it against the slot.
export function selectSlot(name: string, slots: ApprovedWorkload[], setSlotName: (name: string) => void, setDomain: (domain: string) => void, discovered?: string) {
  const slot = slots.find((candidate) => candidate.name === name)
  setSlotName(name)
  if (slot?.domain) {
    setDomain(slot.domain)
    return
  }
  const suffixes = slot?.domainSuffixes ?? []
  const host = (discovered ?? '').trim().toLowerCase()
  setDomain(host && suffixes.some((suffix) => host === suffix || host.endsWith(`.${suffix}`)) ? host : '')
}

export function sourceServiceKey(service: SourceServicePlan) { return `${service.composePath}\u0000${service.service}` }
export function sourceLocation(service: SourceServicePlan) { return service.composePath ? `${service.composePath} · ${service.service}` : service.service }
export function hasBlocker(findings?: SourceFinding[]) { return Boolean(findings?.some((finding) => finding.level === 'blocker')) }

export function blockerFindings(findings?: SourceFinding[]) { return (findings ?? []).filter((finding) => finding.level === 'blocker') }
export function classificationAction(classification: SourceClassification) {
  switch (classification) {
    case 'application': return 'Deploy'
    case 'managed_data': return 'Replace with managed'
    case 'shared_platform': return 'Use platform stack'
    default: return 'Manual redesign required'
  }
}
export function providerLabel(kind: SourceProviderKind) { return kind === 'github' ? 'GitHub' : kind === 'gitlab' ? 'GitLab' : 'Gitea / Forgejo' }
export function defaultConnectionName(kind: SourceProviderKind) { return kind === 'github' ? 'GitHub source' : kind === 'gitlab' ? 'GitLab source' : 'Gitea source' }
export function providerBaseURLPlaceholder(kind: SourceProviderKind) { return kind === 'github' ? 'https://github.example.com/api/v3' : kind === 'gitlab' ? 'https://gitlab.example.com/api/v4' : 'https://git.example.com/api/v1' }
export function providerBaseURLHint(kind: SourceProviderKind) { return kind === 'github' ? 'Leave blank for github.com. GitHub Enterprise usually ends in /api/v3.' : kind === 'gitlab' ? 'Leave blank for gitlab.com. Self-managed GitLab usually ends in /api/v4.' : 'Leave blank for gitea.com. Private Gitea and Forgejo usually end in /api/v1.' }
export function sourceDomainPolicy(slot: ApprovedWorkload) { return slot.domainOptional ? `Optional${slot.domainSuffixes?.length ? ` under ${slot.domainSuffixes.join(', ')}` : ''}` : slot.domainSuffixes?.length ? `One hostname under ${slot.domainSuffixes.join(', ')}` : slot.domain || 'Internal only' }
export function dynamicDomainHint(slot: ApprovedWorkload) { return slot.domainSuffixes?.length ? `Use one hostname under ${slot.domainSuffixes.join(' or ')}. Leave empty only when the slot permits no route.` : 'Leave empty to deploy without a public route.' }
export function telemetryStacks(service: SourceServicePlan) { return service.metrics || service.tracing ? 'swarmops-observability' : '' }
export function removalPhrase(connection?: SourceConnection) { return connection ? `REMOVE_SOURCE_${connection.id.slice(0, 8).toUpperCase()}` : '' }
export function normalizeArray<T>(value: T[] | null | undefined) { return Array.isArray(value) ? value : [] }
