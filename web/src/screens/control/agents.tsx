import { useState } from 'react'
import { Badge, Banner, Body, Button, Inline, Mono, Panel, Stack as Rows, Table, useToast } from '@nim.zone/ui'
import type { TableColumn } from '@nim.zone/ui'
import { api } from '../../data/api'
import type { Server } from '../../data/types'
import { messageOf } from '../../lib/errors'
import { formatDateTime } from '../../lib/format'
import { Screen } from '../../components/screen'
import type { WorkspacePage } from '../../navigation/navigation'
import { isConnectedNativeAgent, isNativeAgent } from '../../data/server-connection'

type Toast = ReturnType<typeof useToast>

/**
 * The software on every host, as one list.
 *
 * Updating an agent was reachable only from one machine's own row, which is
 * fine for updating one machine and useless for the question an operator
 * actually has: is anything out of step. An agent that is behind does not
 * merely run older code — it does not know the commands added since it
 * shipped, and rejects them. That is the connection this screen exists to
 * make, because nowhere else in the console could state it.
 */
export function AgentsPage({ onOpen, onRefresh, servers, toast }: {
  onOpen: (page: WorkspacePage) => void
  onRefresh: () => Promise<void>
  servers: Server[]
  toast: Toast
}) {
  const [pending, setPending] = useState('')

  const agents = servers.filter(isNativeAgent)
  const versions = new Map<string, number>()
  for (const agent of agents) {
    const version = agentVersion(agent)
    versions.set(version, (versions.get(version) ?? 0) + 1)
  }
  // The version the most machines run is the one the fleet is ON; anything
  // else is behind or ahead of it, and both are worth seeing.
  const common = [...versions.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? ''
  const outOfStep = agents.filter((agent) => agentVersion(agent) !== common)

  const update = async (server: Server) => {
    setPending(server.id)
    try {
      await api.requestAgentUpdate(server.id)
      toast({ message: `Update requested on ${server.name}. It downloads, verifies and health-checks its own release.`, tone: 'success' })
      await onRefresh()
    } catch (reason) {
      toast({ duration: 0, message: messageOf(reason), tone: 'danger' })
    } finally {
      setPending('')
    }
  }

  const columns: TableColumn<Server>[] = [
    { header: 'Machine', key: 'name', render: (server) => <strong>{server.name}</strong> },
    {
      header: 'Running',
      key: 'version',
      render: (server) => {
        const version = agentVersion(server)
        if (version === 'unknown') return <Body size="sm" tone="muted">Not reported</Body>
        return (
          <Inline>
            <Mono>{version}</Mono>
            {version === common
              ? <Badge variant="success">Current</Badge>
              : <Badge variant="warning">Out of step</Badge>}
          </Inline>
        )
      },
    },
    {
      header: 'Connection',
      key: 'connection',
      render: (server) => (isConnectedNativeAgent(server)
        ? <Body size="sm">Answering{server.lastConnectedAt ? ` · ${formatDateTime(server.lastConnectedAt)}` : ''}</Body>
        : <Body size="sm" tone="muted">Not answering</Body>),
    },
    {
      header: '',
      key: 'actions',
      render: (server) => (
        <Button
          disabled={!isConnectedNativeAgent(server) || Boolean(pending)}
          onClick={() => void update(server)}
          size="sm"
        >
          {pending === server.id ? 'Requesting…' : 'Update agent'}
        </Button>
      ),
    },
  ]

  return (
    <Screen
      about="An agent updates itself the way the controller does: it downloads its own release, verifies the checksum, starts the candidate beside the running one, and only retires the old process once the new one answers. The controller never sends a binary."
      insights={[
        {
          hint: agents.length ? `Running ${common || 'an unreported version'}` : 'No machine has an agent yet',
          icon: 'server',
          label: 'On the common version',
          onOpen: () => onOpen('machines'),
          source: 'agent handshakes',
          tone: agents.length && outOfStep.length === 0 ? 'success' : 'neutral',
          value: `${agents.length - outOfStep.length} / ${agents.length}`,
        },
        {
          hint: outOfStep.length
            ? 'A machine behind the fleet rejects commands added after its release'
            : 'Every machine accepts the same commands',
          icon: outOfStep.length ? 'alert' : 'check-circle',
          label: 'Out of step',
          source: 'agent handshakes',
          tone: outOfStep.length ? 'warning' : 'success',
          value: String(outOfStep.length),
        },
        {
          hint: 'Nothing installs itself. You choose when, and it rolls one machine at a time.',
          icon: 'settings',
          label: 'Update policy',
          source: 'installer configuration',
          value: 'Manual',
        },
      ]}
      page="agents"
    >
      {outOfStep.length ? (
        <Banner title="Some machines are running a different agent" tone="warning">
          A machine whose agent predates a command simply refuses it, and the refusal looks like a failed run rather
          than a version problem. Updating brings the whole fleet back to one vocabulary.
        </Banner>
      ) : null}

      <Panel
        description="One machine at a time. A candidate that never answers its own health check is deleted and the running agent keeps serving."
        title="Every machine"
      >
        {agents.length
          ? <Table columns={columns} rowKey={(server) => server.id} rows={agents} />
          : (
            <Rows gap="tight">
              <Body size="sm">No machine has an agent yet.</Body>
              <div><Button onClick={() => onOpen('machines')} size="sm">Add a machine</Button></div>
            </Rows>
          )}
      </Panel>

      <Panel eyebrow="What an update actually does" title="The rollout, step by step">
        <Rows as="ol" className="nim-body nim-body--sm" gap="tight">
          <li>The agent fetches its own release bundle and checks the published SHA-256. The controller sends no binary and holds no credential for the machine.</li>
          <li>The candidate starts beside the running agent. The running one keeps answering polls throughout.</li>
          <li>The candidate has to answer its own health endpoint. If it never does, it is deleted and nothing changed.</li>
          <li>The poll loop hands over, and work already in flight finishes on the old process.</li>
          <li>The previous release stays on disk. Three are kept, which is what a roll back restores.</li>
        </Rows>
      </Panel>
    </Screen>
  )
}

/**
 * The version an agent reported at its last handshake.
 *
 * "Not reported" and "old" are different facts and the screen shows them
 * differently: one is a machine that has not spoken, the other is a machine
 * that has and is behind.
 */
function agentVersion(server: Server): string {
  const reported = server.agentHealth?.agentVersion ?? ''
  return reported.trim() || 'unknown'
}
