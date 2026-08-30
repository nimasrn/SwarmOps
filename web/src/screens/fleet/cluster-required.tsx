import {
  Button,
  Columns,
  Icon,
  Inline,
  List,
  ListRow,
  Panel,
  TaskProgress,
} from '@nim.zone/ui'
import type { Server } from '../../data/types'
import { isServerConnected, serverCanManage } from '../../lib/health'
import { pageEntry, type WorkspacePage } from '../../navigation/navigation'
import { Screen } from '../../components/screen'

/**
 * What to do when a cluster screen has no cluster.
 *
 * Three genuinely different situations were previously one screen showing the
 * same three counters. What the operator has to DO differs in each — install,
 * reconnect, prepare, or simply choose — so the heading, the button and the
 * reason differ with them, and the progress track shows which of the three
 * steps is the one they are standing on.
 */
export function ClusterRequiredPage({
  onOpenProvisioning,
  onOpenServers,
  page,
  servers,
}: {
  onOpenProvisioning: () => void
  onOpenServers: () => void
  page: WorkspacePage
  servers: Server[]
}) {
  const entry = pageEntry(page)
  const connected = servers.filter(isServerConnected)
  const managers = servers.filter(serverCanManage)

  const stage = managers.length ? 'select' : connected.length ? 'prepare' : servers.length ? 'reconnect' : 'install'
  const copy = {
    install: {
      action: 'Connect your first server',
      reason: 'SwarmOps has no enrolled host yet. Enrollment is one outbound command on Ubuntu — the agent generates its own key, pins this controller, and waits for you to approve its code. No inbound port and no SSH access is opened.',
      title: 'No server is connected yet',
    },
    reconnect: {
      action: 'Review server connections',
      reason: `${servers.length === 1 ? 'The enrolled host is' : 'None of the enrolled hosts are'} currently answering the controller. Until an agent reconnects there is no evidence to read, and a screen drawn from stale evidence would be a claim SwarmOps cannot support.`,
      title: 'No agent is answering',
    },
    prepare: {
      action: 'Open host setup',
      reason: 'A host is connected but is not a Docker Swarm manager, so there is no cluster to read. Host setup installs Docker, initialises Swarm, and settles the firewall through reviewed, audited fixes.',
      title: 'The connected host is not a Swarm manager',
    },
    select: {
      action: 'Choose a cluster',
      reason: 'A Swarm manager is ready but this console is not pointed at one. Selection is deliberate: every read and every change stays scoped to one explicit target rather than fanning out across the fleet.',
      title: 'Choose which cluster to operate',
    },
  }[stage]

  return (
    <Screen
      actions={
        <Button
          iconStart={stage === 'prepare' ? 'check-circle' : stage === 'install' ? 'plus' : 'server'}
          onClick={stage === 'prepare' ? onOpenProvisioning : onOpenServers}
          variant="accent"
        >
          {copy.action}
        </Button>
      }
      insights={[
        { hint: servers.length ? 'Hosts with an approved agent identity' : 'No host has completed enrollment', icon: 'server', label: 'Enrolled hosts', tone: servers.length ? 'accent' : 'neutral', value: String(servers.length) },
        { hint: connected.length ? 'Agents currently answering outbound long polls' : 'No agent is answering the controller', icon: 'link', label: 'Answering agents', tone: connected.length ? 'success' : 'warning', value: String(connected.length) },
        { hint: managers.length ? 'Hosts that can be selected as a cluster target' : 'Swarm control is unavailable on every host', icon: 'layers', label: 'Swarm managers', tone: managers.length ? 'success' : 'warning', value: String(managers.length) },
      ]}
      page={page}
      subtitle={copy.reason}
      title={copy.title}
    >
      <Columns align="start" template="two-thirds">
        <Panel
          description={`Each step is reversible and leaves an audit record. ${entry.label} resumes by itself the moment the last one is done.`}
          title="What it takes to reach this screen"
        >
          <TaskProgress
            steps={[
              { id: 'enroll', label: 'Enroll a host and let its agent connect', status: servers.length ? (connected.length ? 'done' : 'active') : 'active' },
              { id: 'prepare', label: 'Make the host a Docker Swarm manager', status: managers.length ? 'done' : connected.length ? 'active' : 'pending' },
              { id: 'select', label: `Select that cluster and open ${entry.label}`, status: managers.length ? 'active' : 'pending' },
            ]}
            title="Three steps, in order"
          />
        </Panel>

        <Panel description="Nothing here depends on a selected cluster, so setup is never a dead end." title="Open while you wait">
          <List plain>
            <ListRow href="#servers" leading={<Icon name="server" size="sm" />} subtitle="Enroll a host, approve its code, or read why one dropped." title="Servers" />
            <ListRow href="#agent-diagnostics" leading={<Icon name="link" size="sm" />} subtitle="See which layer — agent, Docker, or Swarm — stopped answering." title="Connection diagnostics" />
            <ListRow href="#commands" leading={<Icon name="activity" size="sm" />} subtitle="Follow queued, running, failed, and recovered operations." title="Runs" />
            <ListRow href="#audit" leading={<Icon name="shield" size="sm" />} subtitle="Read the append-only record of operator activity." title="Audit trail" />
          </List>
          <Inline>
            <Button onClick={onOpenServers} size="sm" variant="secondary">Servers</Button>
            <Button onClick={onOpenProvisioning} size="sm" variant="ghost">Host setup</Button>
          </Inline>
        </Panel>
      </Columns>
    </Screen>
  )
}
