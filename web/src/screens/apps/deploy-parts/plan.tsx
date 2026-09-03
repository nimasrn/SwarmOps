import {
  Banner,
  Body,
  Button,
  CopyChip,
  Icon,
  Inline,
  Input,
  Label,
  List,
  ListRow,
  Rail,
  RailSection,
  Select,
  Switch,
} from '@nim.zone/ui'
import type {
  ApprovedWorkload,
  SourceFinding,
  SourcePlan,
  SourceServicePlan,
} from '../../../data/types'
import { formatDateTime } from '../../../lib/format'
import {
  DOMAIN_FIELD_ID,
  TELEMETRY_FIELD_ID,
  DependencyMark,
  engineName,
  stackName,
} from './parts'

/**
 * The decision column of the source flow: what SwarmOps is about to deploy,
 * where, and what still stands in the way.
 *
 * It is a rail rather than a step because it is read WHILE the stages on the
 * left are worked through, not after them — an operator choosing a service
 * needs to see, at that moment, that the slot they picked has no domain.
 */

// databaseDelivery says, per engine, exactly which variables this application
// will read its connection string from. An operator who can see this can tell
// at a glance whether the attachment will actually work — which is the failure
// the discovery step exists to prevent.
function databaseDelivery(service: SourceServicePlan | undefined, engine: string) {
  const requirement = service?.databaseRequirements?.find((candidate) => candidate.engine === engine)
  if (requirement?.envVars?.length) return `Delivered as ${requirement.envVars.join(', ')}`
  return `Delivered as ${engine.toUpperCase()}_URL_FILE`
}

export function DeploymentPlan({
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
  slotCreatable,
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
  /** True when this controller can declare the slot itself, so a name that no
      reviewed slot owns is a new slot rather than a refused deployment. */
  slotCreatable?: boolean
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
      <RailSection meta={selectedService ? '1 service' : 'None selected'} title="Applications">
        {selectedService ? (
          <List plain>
            <ListRow
              leading={<Icon name="check-circle" size="sm" tone="success" />}
              title={selectedService.name}
              trailing={
                <Inline gap="tight">
                  <Label>Slot</Label>
                  {approved.length > 0 ? <Select aria-label="Approved slot" onChange={(event) => onChooseSlot(event.target.value)} options={approved.map((slot) => ({ label: slot.name, value: slot.name }))} placeholder={slotCreatable ? 'Reviewed slot' : 'Slot'} value={approved.some((slot) => slot.name === slotName) ? slotName : ''} /> : null}
                  {slotCreatable ? <Input aria-label="Application name" onChange={(event) => onChooseSlot(event.target.value)} placeholder="Name" value={slotName} /> : null}
                </Inline>
              }
            />
          </List>
        ) : (
          <Body size="sm">No service is selected yet.</Body>
        )}
      </RailSection>

      <RailSection meta={selectedService ? '1 image' : 'None selected'} title="Images (immutable)">
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
          <>
            <List plain>
              {databases.map((database) => (
                <ListRow
                  key={database}
                  leading={<DependencyMark name={database} fallback="database" />}
                  subtitle={databaseDelivery(selectedService, database)}
                  title={engineName(database)}
                  trailing={<Icon name="check" size="xs" tone="success" />}
                />
              ))}
            </List>
            {/* The account, not just the database. Saying so here is the
                difference between an operator believing this application
                shares the cluster credential and knowing it does not. */}
            <Body size="sm" tone="muted">Each database gets this application its own user, its own logical database, and only the grants it needs. SwarmOps waits for the engine to pass its health check and provisions the account before the application starts.</Body>
          </>
        ) : (
          <Body size="sm">None detected in the provider Compose.</Body>
        )}
      </RailSection>

      {selectedService?.dockerfile ? (
        <RailSection meta={`${selectedService.dockerfile.stages} stage${selectedService.dockerfile.stages === 1 ? '' : 's'}`} title="Image build">
          <List plain>
            <ListRow leading={<Icon name="document" size="sm" />} subtitle={selectedService.dockerfile.baseImages?.join(' → ') || 'No base image was read'} title={selectedService.dockerfile.path} />
            <ListRow leading={<Icon name={selectedService.dockerfile.runsAsRoot ? 'alert' : 'check-circle'} size="sm" tone={selectedService.dockerfile.runsAsRoot ? 'warning' : 'success'} />} subtitle={selectedService.dockerfile.runsAsRoot ? 'No USER instruction; the container runs as root' : 'Drops root through a USER instruction'} title="Container user" />
            <ListRow leading={<Icon name={selectedService.dockerfile.entrypoint ? 'check-circle' : 'alert'} size="sm" tone={selectedService.dockerfile.entrypoint ? 'success' : 'warning'} />} subtitle={selectedService.dockerfile.entrypoint ? 'The final stage declares CMD or ENTRYPOINT' : 'The image starts only if its base supplies a command'} title="Start command" />
            <ListRow leading={<Icon name="link" size="sm" />} subtitle={selectedService.dockerfile.exposedPorts?.length ? `EXPOSE ${selectedService.dockerfile.exposedPorts.join(', ')}` : 'No EXPOSE instruction'} title="Declared ports" />
          </List>
        </RailSection>
      ) : null}

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

      <RailSection meta={<EditLink label="Edit domain" target={DOMAIN_FIELD_ID} />} title="Route">
        <Body size="sm">{domain || selectedSlot?.domain || 'Internal only — no public route'}</Body>
        <Body size="sm" tone="muted">{selectedSlot ? `Certificate resolver: ${selectedSlot.resolver || 'none'}` : 'A reviewed slot owns the domain policy.'}</Body>
        {/* Where the hostname came from is the operator's cue for whether to
            trust the prefilled value or replace it. */}
        {selectedService?.route ? (
          <Body size="sm" tone="muted">
            {selectedService.route.source === 'traefik_labels'
              ? `Read from this repository's own Traefik router${selectedService.route.hosts?.length ? `: ${selectedService.route.hosts.join(', ')}` : ''}${selectedService.route.pathPrefix ? ` at ${selectedService.route.pathPrefix}` : ''}.`
              : 'No Traefik router was found in the repository; SwarmOps proposes an internal-only route.'}
          </Body>
        ) : null}
        <Body size="sm" tone="muted">SwarmOps creates the route if the cluster does not already have one, and installs the Traefik edge first when it is missing.</Body>
      </RailSection>

      <RailSection meta={<EditLink label="Edit telemetry" target={TELEMETRY_FIELD_ID} />} title="Telemetry">
        <Switch checked={metrics} id={TELEMETRY_FIELD_ID} onChange={(event) => onToggleMetrics(event.target.checked)}>Metrics (Prometheus)</Switch>
        {metrics && selectedService?.telemetry?.metricsPath ? <Body size="sm" tone="muted">Scraped at {selectedService.telemetry.metricsPath}{selectedService.telemetry.metricsPort ? ` on port ${selectedService.telemetry.metricsPort}` : ''}, read from this repository's own Prometheus annotations.</Body> : null}
        {/* Traces and logs are reported, not switched. Both are cluster-wide
            reviewed stacks: turning one on from a deployment plan would queue
            a platform change under the heading of one application. */}
        <Switch checked={Boolean(selectedService?.tracing)} disabled readOnly>Traces (OpenTelemetry)</Switch>
        {selectedService?.tracing ? <Body size="sm" tone="muted">{selectedService.telemetry?.tracingEnvVars?.length ? `${selectedService.telemetry.tracingEnvVars.join(', ')} is repointed at the managed Jaeger OTLP collector.` : 'Traces are sent to the managed Jaeger OTLP collector.'}</Body> : null}
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
