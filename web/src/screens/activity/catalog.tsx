import { useEffect, useMemo, useState } from 'react'
import {
  Badge,
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
  Select,
  Sheet,
  Spinner,
  Stack as Rows,
  Switch,
  useToast,
} from '@nim.zone/ui'
import { api } from '../../data/api'
import type { CommandDefinition, CommandParameter, Server } from '../../data/types'
import { shortID } from '../../lib/format'
import { messageOf } from '../../lib/errors'
import { useResource } from '../../data/hooks'
import { Screen } from '../../components/screen'

type Toast = ReturnType<typeof useToast>

export function CommandCataloguePage({
  activeServerID,
  onQueued,
  servers,
  toast,
}: {
  activeServerID: string
  onQueued: (commandID: string) => void
  servers: Server[]
  toast: Toast
}) {
  const { data, error, loading } = useResource(() => api.commandCatalogue(), [])
  const [selected, setSelected] = useState<CommandDefinition | null>(null)
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('all')
  const grouped = useMemo(() => {
    const groups = new Map<string, CommandDefinition[]>()
    const filtered = (data ?? []).filter((definition) => {
      const matchesQuery = !query || `${definition.title} ${definition.description} ${definition.resource} ${definition.action}`.toLowerCase().includes(query.toLowerCase())
      const matchesKind = kind === 'all' || (kind === 'mutation' ? definition.mutation : !definition.mutation)
      return matchesQuery && matchesKind
    })
    for (const definition of filtered) {
      const entries = groups.get(definition.resource) ?? []
      entries.push(definition)
      groups.set(definition.resource, entries)
    }
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right))
  }, [data, kind, query])

  if (loading && !data) {
    return (
      <Screen page="catalog">
        <Panel><Spinner label="Reading the command vocabulary" /></Panel>
      </Screen>
    )
  }
  if (error) {
    return (
      <Screen page="catalog">
        <Banner tone="danger" title="The catalogue is unavailable">{error}</Banner>
      </Screen>
    )
  }

  const mutations = (data ?? []).filter((definition) => definition.mutation).length
  const reads = (data ?? []).length - mutations
  const destructive = (data ?? []).filter((definition) => definition.destructive).length
  const target = servers.find((server) => server.id === activeServerID)

  return (
    <Screen
      about={"Every change is explicitly targeted, audited, and visible under Runs. There is no arbitrary command, file read, shell, or socket proxy behind any of these — the list is the whole vocabulary."}
      insights={[
        { hint: 'Projections of Docker and Swarm state', icon: 'document', label: 'Read operations', value: String(reads) },
        { hint: 'Queued, CSRF-protected, and audited', icon: 'terminal', label: 'Mutations', value: String(mutations) },
        { hint: 'Require a typed confirmation phrase', icon: 'alert', label: 'Destructive', tone: 'warning', value: String(destructive) },
        { hint: target ? `Actions run against ${target.name}` : 'Choose a target before running an action', icon: 'server', label: 'Target', tone: target ? 'accent' : 'warning', value: target?.name ?? 'None selected' },
      ]}
      page="catalog"
      width="full"
    >
      <Columns>
        <Input iconStart="search" label="Search actions" onChange={(event) => setQuery(event.target.value)} placeholder="Diagnostics, image, service…" value={query} />
        <Select label="Action type" onChange={(event) => setKind(event.target.value)} options={[{ label: 'All actions', value: 'all' }, { label: 'Read-only', value: 'read' }, { label: 'Changes', value: 'mutation' }]} value={kind} />
      </Columns>
      {selected ? <CommandRunner
          defaultServerID={activeServerID}
          definition={selected}
          onClose={() => setSelected(null)}
          onQueued={onQueued}
          servers={servers}
          toast={toast}
        /> : null}
      {grouped.map(([resource, definitions]) => (
        <Panel eyebrow={`${definitions.length} operation${definitions.length === 1 ? '' : 's'}`} flush key={resource} title={resourceTitle(resource)}>
          <DataTable
            caption={`SwarmOps operations for ${resource}`}
            columns={[
              {
                header: 'Operation',
                key: 'title',
                render: (definition: CommandDefinition) => (
                  <Rows gap="tight">
                    <strong>{definition.title}</strong>
                    <Body size="sm">{definition.description}</Body>
                  </Rows>
                ),
              },
              { header: 'Docker', key: 'docker', render: (definition: CommandDefinition) => <Mono>{definition.docker}</Mono> },
              { header: 'API', key: 'endpoint', render: (definition: CommandDefinition) => <Mono>{definition.endpoint}</Mono> },
              {
                header: 'Guards',
                key: 'guards',
                render: (definition: CommandDefinition) => (
                  <Inline>
                    <Badge variant={definition.mutation ? 'warning' : 'neutral'}>{definition.mutation ? 'Mutation' : 'Read'}</Badge>
                    {definition.destructive ? <Badge variant="danger">Destructive</Badge> : null}
                    {definition.autoRetry ? <Badge>Auto-retry</Badge> : null}
                  </Inline>
                ),
              },
              {
                header: '',
                key: 'run',
                render: (definition: CommandDefinition) => (
                  <Button onClick={() => setSelected(definition)} size="sm" variant={definition.destructive ? 'ghost' : 'secondary'}>Review action</Button>
                ),
              },
            ]}
            empty={<EmptyState description="No operation is registered for this resource." icon="terminal" title="No operations" />}
            rowKey={(definition: CommandDefinition) => definition.action}
            rows={definitions}
          />
        </Panel>
      ))}
    </Screen>
  )
}

// CommandRunner builds its form from the catalogue entry alone and sends the
// request the same entry describes. It adds no capability: a read runs and
// shows what came back, a mutation is queued in the ledger like every other
// write, and a destructive entry stays disabled until its phrase is typed.
function CommandRunner({
  defaultServerID,
  definition,
  onClose,
  onQueued,
  servers,
  toast,
}: {
  defaultServerID: string
  definition: CommandDefinition
  onClose: () => void
  onQueued: (commandID: string) => void
  servers: Server[]
  toast: Toast
}) {
  const [values, setValues] = useState<Record<string, boolean | number | string>>({})
  // An operation is executed on ONE named server. It defaults to the target
  // the shell has selected, but the runner asks explicitly: a command queued
  // against the wrong cluster is not recoverable by editing it afterwards.
  const [serverID, setServerID] = useState(defaultServerID)
  const [result, setResult] = useState<unknown>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const initial: Record<string, boolean | number | string> = {}
    for (const parameter of definition.parameters ?? []) {
      if (parameter.kind === 'switch') initial[parameter.name] = false
      if (parameter.kind === 'select' || parameter.kind === 'hidden') initial[parameter.name] = parameter.options?.[0] ?? ''
    }
    setValues(initial)
    setResult(null)
    setError('')
    setServerID(defaultServerID)
  }, [defaultServerID, definition.action])

  const set = (name: string, value: boolean | number | string) => setValues((current) => ({ ...current, [name]: value }))
  // The phrase the API will check, with the target the operator has typed
  // substituted in — so the console never asks for a phrase the server rejects.
  const confirmation = expectedConfirmation(definition, values)
  const confirmationParameter = (definition.parameters ?? []).find((parameter) => parameter.kind === 'confirmation')
  const unconfirmed = confirmationParameter ? values[confirmationParameter.name] !== confirmation : false
  const eligible = servers.filter(serverCanRunCataloguedOperation)
  const target = servers.find((server) => server.id === serverID)
  const targetReady = Boolean(target && serverCanRunCataloguedOperation(target))
  const blocked = unconfirmed || !targetReady

  const run = async () => {
    setPending(true)
    setError('')
    setResult(null)
    try {
      const payload = await api.runCatalogued(definition, values, serverID)
      setResult(payload)
      if (definition.mutation) {
        const queued = payload as { id?: string }
        toast({ message: `${definition.title} queued on ${target?.name ?? serverID}${queued?.id ? ` (${shortID(queued.id)})` : ''}`, tone: 'success' })
        if (queued.id) onQueued(queued.id)
      }
    } catch (reason) {
      setError(messageOf(reason))
    } finally {
      setPending(false)
    }
  }

  return (
    <Sheet closeLabel="Close action review" onClose={onClose} open title={definition.title}>
      <Rows>
        <Body size="sm">{definition.description}</Body>
        <Facts items={[
          { label: 'Target', value: target ? `${target.name} · ${target.host}` : 'Choose a server below' },
          { label: 'Expected result', value: definition.mutation ? 'A durable run appears in Activity and executes on the selected server.' : 'A read-only result appears in this sheet.' },
          { label: 'Impact', value: definition.destructive ? 'Destructive change; exact confirmation required.' : definition.mutation ? 'Changes server state through one reviewed operation.' : 'Read-only; no server state is changed.' },
          { label: 'Operation', mono: true, value: definition.docker },
          ...(confirmation ? [{ label: 'Confirmation', mono: true, value: confirmation }] : []),
        ]} />
        <Select
          hint={
            definition.mutation
              ? 'The command is queued for this server and executed against it by the durable worker.'
              : 'The read is answered by this server, not by whichever target the shell has selected.'
          }
          label="Server"
          onChange={(event) => setServerID(event.target.value)}
          options={[
            { label: eligible.length ? 'Choose a server…' : 'No connected Swarm manager', value: '' },
            ...servers.map((server) => ({
              label: serverOptionLabel(server),
              value: server.id,
            })),
          ]}
          value={serverID}
        />
        {serverID && !targetReady ? (
          <Banner tone="warning" title="That server cannot run this">
            An operation runs only against a connected remote Swarm manager. Connect the target from Servers, or choose
            one that already reports Swarm control.
          </Banner>
        ) : null}
        {(definition.parameters ?? []).filter((parameter) => parameter.kind !== 'hidden').map((parameter) => (
          <CommandField
            confirmation={parameter.kind === 'confirmation' ? confirmation : undefined}
            key={parameter.name}
            onChange={(value) => set(parameter.name, value)}
            parameter={parameter}
            value={values[parameter.name]}
          />
        ))}
        {error ? <Banner tone="danger" title="The operation was refused">{error}</Banner> : null}
        <Inline>
          <Button
            disabled={blocked}
            loading={pending}
            onClick={() => void run()}
            variant={definition.destructive ? 'danger' : 'primary'}
          >
            {definition.mutation ? 'Queue command' : 'Run'}
          </Button>
          {!targetReady ? <Body size="sm">Choose a connected Swarm manager to run this on.</Body> : null}
          {targetReady && unconfirmed ? <Body size="sm">Type the confirmation phrase above to enable this.</Body> : null}
        </Inline>
        {result !== null && result !== undefined ? (
          <Rows gap="tight">
            <Label as="p">Result</Label>
            <CodeBlock label={`${definition.action} response`}>{JSON.stringify(result, null, 2).slice(0, 20000)}</CodeBlock>
            <Body size="sm">
              {definition.mutation
                ? `The response is the queued run for ${target?.name ?? serverID}. Follow it to completion under Activity → Runs.`
                : `This is exactly what ${target?.name ?? 'the controller'} returned, including the fields it withholds by design.`}
            </Body>
          </Rows>
        ) : null}
      </Rows>
    </Sheet>
  )
}

function CommandField({
  confirmation,
  onChange,
  parameter,
  value,
}: {
  confirmation?: string
  onChange: (value: boolean | number | string) => void
  parameter: CommandParameter
  value: boolean | number | string | undefined
}) {
  if (parameter.kind === 'switch') {
    return (
      <Switch checked={Boolean(value)} description={parameter.hint} onChange={(event) => onChange(event.target.checked)}>
        {parameter.label}
      </Switch>
    )
  }
  if (parameter.kind === 'select') {
    return (
      <Select
        hint={parameter.hint}
        label={parameter.label}
        onChange={(event) => onChange(event.target.value)}
        options={(parameter.options ?? []).map((option) => ({ label: option, value: option }))}
        value={String(value ?? '')}
      />
    )
  }
  return (
    <Input
      hint={parameter.kind === 'confirmation' ? `Type ${confirmation ?? 'the phrase'} exactly.` : parameter.hint}
      label={parameter.label}
      onChange={(event) => onChange(event.target.value)}
      placeholder={parameter.kind === 'confirmation' ? confirmation : parameter.placeholder}
      type={parameter.kind === 'number' ? 'number' : 'text'}
      value={String(value ?? '')}
    />
  )
}

// expectedConfirmation fills the catalogue's phrase template from what the
// operator has typed. The server derives the same phrase from the same target,
// so a mismatch here is a mismatch there.
function expectedConfirmation(definition: CommandDefinition, values: Record<string, boolean | number | string>) {
  if (!definition.confirmation) return ''
  return definition.confirmation.replace(/\{([A-Z]+)\}/g, (_match, token: string) => {
    const key = token.toLowerCase()
    const direct = values[key === 'role' ? 'role' : key]
    if (direct !== undefined && direct !== '') return String(direct).toUpperCase()
    // ID and NAME are the path target under whichever name the entry uses.
    const fallback = values.id ?? values.name ?? values.resource ?? ''
    return String(fallback).toUpperCase()
  })
}

function resourceTitle(resource: string) {
  return resource.charAt(0).toUpperCase() + resource.slice(1)
}

/**
 * serverOptionLabel says in the option itself why a target cannot be used, so
 * the operator does not pick one and then read a refusal.
 */
function serverOptionLabel(server: Server) {
  if (server.connectionState !== 'connected') return `${server.name} — not connected`
  if (server.agentHealth?.state === 'unhealthy') return `${server.name} — machine agent unreachable`
  if (server.agentHealth?.state === 'degraded') return `${server.name} — agent needs attention`
  if (!server.swarmControlAvailable) return `${server.name} — not a Swarm manager`
  return `${server.name} · ${server.host}`
}

function serverCanRunCataloguedOperation(server: Server) {
  return server.connectionState === 'connected' && server.swarmControlAvailable && server.agentHealth?.state === 'healthy'
}
