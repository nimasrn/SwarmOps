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
  Stack as Rows,
  useToast,
} from '@nim.zone/ui'
import type { TableColumn } from '@nim.zone/ui'
import { api } from '../../data/api'
import type { Service } from '../../data/types'
import { formatDateTime, shortID } from '../../lib/format'
import { messageOf } from '../../lib/errors'
import { StatusBadge } from '../../components/badges'
import { ConfirmPhrase } from '../../components/confirm-phrase'
import { ChangePreviewPanel } from './change-preview'
import { ServiceDiagnosis, useServiceDiagnosis } from './service-diagnosis'

type Toast = ReturnType<typeof useToast>

/**
 * The processes Swarm is keeping alive, and what an operator does to one.
 *
 * A degraded service is the only reason anyone opens this screen in a hurry, so
 * the diagnosis is FETCHED for the selected service rather than hidden behind a
 * button — the question "why" is already the reason they are here.
 *
 * Read, scale, restart and roll back were wired; rolling out a new image,
 * changing limits, and removing the service were not, although the controller
 * queues all three as audited commands. The gap was most visible in the change
 * preview at the bottom of this screen, which computed exactly what a new image
 * would do and then answered Apply with a toast saying it was not wired.
 */
export function ServicesTab({
  onDiagnosisAction,
  onOpenLogs,
  services,
  toast,
}: {
  onDiagnosisAction: (kind: string) => void
  onOpenLogs: () => void
  services: Service[]
  toast: Toast
}) {
  const [selectedID, setSelectedID] = useState(services[0]?.id ?? '')
  const [logs, setLogs] = useState('')
  const [logsError, setLogsError] = useState('')
  const [busy, setBusy] = useState('')
  const [replicas, setReplicas] = useState(String(services[0]?.desiredTasks ?? 0))
  const [scaleError, setScaleError] = useState('')
  const [cpus, setCpus] = useState('')
  const [memory, setMemory] = useState('')
  const [limitsError, setLimitsError] = useState('')

  const selected = services.find((service) => service.id === selectedID) ?? services[0]
  const degraded = selected ? selected.runningTasks < selected.desiredTasks : false
  const diagnosis = useServiceDiagnosis(degraded && selected ? selected.id : null, (id) => api.serviceDiagnosis(id))

  useEffect(() => {
    if (selected) setReplicas(String(selected.desiredTasks))
    setScaleError('')
  }, [selected?.desiredTasks, selected?.id])

  const readLogs = async (service: Service) => {
    setSelectedID(service.id)
    setLogs('')
    setLogsError('')
    try {
      setLogs((await api.serviceLogs(service.id)).logs)
    } catch (reason) {
      setLogsError(messageOf(reason))
    }
  }

  const act = async (kind: 'restart' | 'rollback' | 'scale', count?: number) => {
    if (!selected) return
    const replicaCount = count ?? Number(replicas)
    if (kind === 'scale' && (!Number.isInteger(replicaCount) || replicaCount < 0 || replicaCount > 1000)) {
      setScaleError('Enter a whole replica count from 0 to 1000.')
      return
    }
    setBusy(kind)
    setScaleError('')
    try {
      const command = await api.serviceAction(selected.id, kind, kind === 'scale' ? replicaCount : undefined)
      const description = kind === 'scale' ? `scale to ${replicaCount}` : kind
      toast({ message: `${selected.name}: ${description} queued (${shortID(command.id)})`, tone: 'success' })
    } catch (reason) {
      toast({ duration: 0, message: messageOf(reason), tone: 'danger' })
    } finally {
      setBusy('')
    }
  }

  // One shape for the three changes the preview and the forms below queue, so
  // each is a call and a sentence rather than its own copy of this block.
  const queue = async (kind: string, description: string, run: () => Promise<{ id: string }>) => {
    if (!selected) return
    setBusy(kind)
    try {
      const command = await run()
      toast({ message: `${selected.name}: ${description} queued (${shortID(command.id)})`, tone: 'success' })
    } catch (reason) {
      toast({ duration: 0, message: messageOf(reason), tone: 'danger' })
      throw reason
    } finally {
      setBusy('')
    }
  }

  const rollOut = (image: string) => {
    void queue('image', `roll out ${image}`, () => api.updateServiceImage(selected.id, image)).catch(() => {})
  }

  const applyLimits = () => {
    // The control plane accepts cores such as 1.5 and memory such as 512M or
    // 2G, and refuses anything else. Saying so here means the operator is
    // corrected while typing rather than by a failed run.
    if (!/^\d{1,2}(\.\d{1,2})?$/.test(cpus.trim())) {
      setLimitsError('CPU is a core count such as 1 or 1.5, up to 99.')
      return
    }
    if (!/^[1-9]\d{0,5}[MG]$/.test(memory.trim())) {
      setLimitsError('Memory is a whole number with an M or G suffix, such as 512M or 2G.')
      return
    }
    setLimitsError('')
    void queue('limits', `limits ${cpus.trim()} CPU / ${memory.trim()}`, () => api.updateServiceLimits(selected.id, cpus.trim(), memory.trim())).catch(() => {})
  }


  const columns: TableColumn<Service>[] = [
    { header: 'Service', key: 'name', render: (service) => <RecordLink meta={service.stack ?? 'unmanaged service'} onClick={() => void readLogs(service)} title={service.name} /> },
    { header: 'Image', key: 'image', render: (service) => <Mono>{service.image ?? 'Not set'}</Mono> },
    { header: 'Tasks', key: 'tasks', numeric: true, render: (service) => `${service.runningTasks} / ${service.desiredTasks}` },
    { header: 'Health', key: 'health', render: (service) => <StatusBadge health={service.health} /> },
    { header: 'Update', key: 'update', render: (service) => service.updateState || 'None in progress' },
  ]

  if (!selected) {
    return (
      <><EmptyState
          description="Docker Engine is reachable, but this Swarm currently schedules zero services. This is normal when workloads run as Docker Compose or standalone containers."
          icon="layers"
          title="No Swarm services"
        />
      </>
    )
  }

  const canScale = selected.mode.toLowerCase() === 'replicated'

  return (
    <>
      <Panel caption={`${services.length} scheduled`} flush title="Swarm services">
        <DataTable
          caption="Docker Swarm services"
          columns={columns}
          empty={<EmptyState description="No services were returned by the remote Docker Engine." icon="layers" title="No services" />}
          rowKey={(service) => service.id}
          rows={services}
        />
      </Panel>

      {degraded ? (
        <ServiceDiagnosis
          error={diagnosis.error}
          loading={diagnosis.loading}
          onAction={onDiagnosisAction}
          result={diagnosis.result}
          serviceName={selected.name}
        />
      ) : null}

      <Columns>
        <Panel eyebrow={selected.stack ?? 'No stack label'} title={selected.name}>
          <Facts items={[
            { label: 'Image', mono: true, value: selected.image || 'Not set' },
            { label: 'Desired tasks', value: String(selected.desiredTasks) },
            { label: 'Running tasks', value: String(selected.runningTasks) },
            { label: 'Last updated', value: formatDateTime(selected.updatedAt) },
          ]} />
          <Inline>
            <Button loading={busy === 'restart'} onClick={() => void act('restart')} variant="secondary">Force restart</Button>
            <Button loading={busy === 'rollback'} onClick={() => void act('rollback')} variant="danger">Roll back</Button>
            <Button onClick={() => void readLogs(selected)} variant="ghost">Read logs</Button>
            {/* The tail below is two hundred lines fetched on demand. Anything
                older, or across more than this one service, is the Logs
                screen — which is a different question and a different tool. */}
            <Button onClick={onOpenLogs} variant="ghost">Search all logs</Button>
          </Inline>
          <Rows gap="tight">
            <Label as="p">Replica control</Label>
            {canScale ? (
              <>
                {/* One-tap scaling. Typing a number and pressing a second
                    button is the right shape for an arbitrary count and the
                    wrong shape for the change actually made under load, which
                    is "one more" or "one fewer". */}
                <Inline gap="tight">
                  <Button
                    disabled={busy !== '' || selected.desiredTasks === 0}
                    iconStart="minus"
                    onClick={() => void act('scale', Math.max(0, selected.desiredTasks - 1))}
                    size="sm"
                    variant="secondary"
                  >
                    Scale down
                  </Button>
                  <Button
                    disabled={busy !== ''}
                    iconStart="plus"
                    onClick={() => void act('scale', selected.desiredTasks + 1)}
                    size="sm"
                    variant="secondary"
                  >
                    Scale up
                  </Button>
                </Inline>
                <Columns>
                  <Input hint="Scale is queued as a fixed, audited Docker action." label="Desired replicas" max="1000" min="0" onChange={(event) => setReplicas(event.target.value)} step="1" type="number" value={replicas} />
                  <Rows gap="tight">
                    <Body size="sm">A scale to zero is allowed and stops this replicated service without deleting it.</Body>
                    <Button disabled={busy !== ''} loading={busy === 'scale'} onClick={() => void act('scale')} variant="secondary">Set replicas</Button>
                  </Rows>
                </Columns>
              </>
            ) : (
              <Body size="sm">This is a {selected.mode} service. Its task count is controlled by its mode, so SwarmOps does not offer a replica change.</Body>
            )}
            {scaleError ? <Banner tone="warning">{scaleError}</Banner> : null}
          </Rows>
        </Panel>

        <Panel eyebrow="Last 200 lines" title="Service logs">
          {logsError ? <Banner tone="danger">{logsError}</Banner> : null}
          {logs
            ? <CodeBlock label={`Last 200 lines · ${selected.name}`}>{logs}</CodeBlock>
            : <EmptyState description="Nothing has been fetched yet. Use Read logs for an on-demand, bounded tail — this is not a statement that the service produced none." icon="document" reason="unknown" title="Logs are not loaded" />}
        </Panel>
      </Columns>

      <ChangePreviewPanel
        applying={busy === 'image'}
        currentImage={selected.image}
        onApply={rollOut}
        serviceID={selected.id}
      />

      <Columns>
        <Panel
          description="Applied to every task of this service as a rolling update. Swarm replaces tasks one at a time and stops if a replacement will not start."
          title="Resource limits"
        >
          <Rows gap="tight">
            <Body size="sm">
              A limit is a ceiling, not a reservation. Setting one below what the process actually uses gets it killed by the
              kernel rather than throttled, so raise it in one step and lower it in several.
            </Body>
            <Columns>
              <Input hint="Cores, such as 1 or 1.5." label="CPU limit" onChange={(event) => setCpus(event.target.value)} placeholder="1.5" value={cpus} />
              <Input hint="A whole number with M or G, such as 512M." label="Memory limit" onChange={(event) => setMemory(event.target.value)} placeholder="512M" value={memory} />
            </Columns>
            {limitsError ? <Banner tone="warning">{limitsError}</Banner> : null}
            <Inline>
              <Button disabled={busy !== '' || !cpus.trim() || !memory.trim()} loading={busy === 'limits'} onClick={applyLimits} variant="secondary">Apply limits</Button>
            </Inline>
          </Rows>
        </Panel>

        <Panel
          description="Removing a service stops every task it runs and deletes its definition. A service that belongs to a stack is recreated by the next deployment of that stack."
          title="Remove this service"
        >
          {selected.stack ? (
            <Banner tone="warning" title={`This service belongs to ${selected.stack}`}>
              Removing it here leaves the stack believing it exists. Redeploying the stack will recreate it; to remove it
              for good, remove it from the Compose file the stack is deployed from.
            </Banner>
          ) : null}
          <ConfirmPhrase
            action="Remove service"
            busy={busy === 'remove'}
            consequence={<>Stops all {selected.runningTasks} running task{selected.runningTasks === 1 ? '' : 's'} of <strong>{selected.name}</strong> and deletes the service. Volumes and their data are not touched.</>}
            disabled={busy !== ''}
            onConfirm={async (confirmation) => {
              await queue('remove', 'removal', () => api.removeService(selected.id, confirmation))
              setSelectedID('')
            }}
            phrase={`REMOVE_SERVICE_${selected.id.toUpperCase()}`}
          />
        </Panel>
      </Columns>
    </>
  )
}
