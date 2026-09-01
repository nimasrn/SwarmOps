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
import { ChangePreviewPanel } from './change-preview'
import { ServiceDiagnosis, useServiceDiagnosis } from './service-diagnosis'

type Toast = ReturnType<typeof useToast>

/**
 * The processes Swarm is keeping alive, and the four things an operator does
 * to one: read it, scale it, restart it, put it back.
 *
 * A degraded service is the only reason anyone opens this screen in a hurry, so
 * the diagnosis is FETCHED for the selected service rather than hidden behind a
 * button — the question "why" is already the reason they are here.
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
        currentImage={selected.image}
        onApply={() => toast({ message: 'Applying from the preview is not wired yet — deploy from the source screen.', tone: 'neutral' })}
        serviceID={selected.id}
      />
    </>
  )
}
