import { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Banner,
  Body,
  Button,
  DetailHeader,
  DetailLayout,
  Facts,
  Icon,
  Inline,
  Input,
  List,
  ListRow,
  Metric,
  MetricGrid,
  Mono,
  Page,
  Panel,
  Rail,
  RailSection,
  Select,
  Spinner,
  Stack as Rows,
  StatusDot,
  Switch,
  useToast,
} from '@nim.zone/ui'
import { api } from './api'
import type { CoreMember, CoreTopology, Server } from './types'

interface CoreTopologyPageProps {
  servers: Server[]
  toast: ReturnType<typeof useToast>
}

// CoreTopologyPage is deliberately not a cluster page. It works before a
// manager is selected because the core is an independent controller identity,
// while Servers stays reserved for normal, explicitly enrolled machine agents.
export function CoreTopologyPage({ servers, toast }: CoreTopologyPageProps) {
  const [topology, setTopology] = useState<CoreTopology | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState('')
  const [agentServerID, setAgentServerID] = useState('')
  const [endpoint, setEndpoint] = useState('')
  const [memberID, setMemberID] = useState('')
  const [name, setName] = useState('')
  const [handoffTarget, setHandoffTarget] = useState('')
  const [fenceConfirmation, setFenceConfirmation] = useState('')
  const [promotionConfirmation, setPromotionConfirmation] = useState('')
  const [primaryStopped, setPrimaryStopped] = useState(false)

  const refresh = async () => {
    setPending('refresh')
    setError('')
    try {
      setTopology(await api.coreTopology())
    } catch (reason) {
      setError(messageOf(reason))
    } finally {
      setPending('')
    }
  }

  useEffect(() => { void refresh() }, []) // The topology has no selected-manager dependency.

  const standbys = useMemo(() => (topology?.members ?? []).filter((member) => member.role === 'standby'), [topology])
  const verifiedStandbys = useMemo(() => standbys.filter((member) => member.replicaState === 'verified'), [standbys])
  const handoff = topology?.handoff
  const plannedPromotion = Boolean(handoff?.state === 'fenced' && handoff.toId === topology?.localId)

  useEffect(() => {
    setHandoffTarget((current) => verifiedStandbys.some((member) => member.id === current) ? current : verifiedStandbys[0]?.id ?? '')
  }, [verifiedStandbys])

  const run = async (operation: string, action: () => Promise<CoreTopology>, success: string): Promise<boolean> => {
    setPending(operation)
    setError('')
    try {
      setTopology(await action())
      toast({ message: success, tone: 'success' })
      return true
    } catch (reason) {
      setError(messageOf(reason))
      return false
    } finally {
      setPending('')
    }
  }

  const addReplica = () => {
    const input = {
      agentServerId: agentServerID || undefined,
      endpoint: endpoint.trim(),
      id: memberID.trim(),
      name: name.trim(),
    }
    if (!input.endpoint || !input.id || !input.name) {
      setError('Enter a core ID, display name, and HTTPS endpoint before preparing a standby.')
      return
    }
    void run('replica', () => api.addCoreReplica(input), `${input.name} is registered as an awaiting-restore standby.`).then((created) => {
      if (!created) return
      setAgentServerID('')
      setEndpoint('')
      setMemberID('')
      setName('')
    })
  }

  return (
    <Page width="full">
      {error ? <Banner title="Control-plane action needs attention" tone="danger">{error}</Banner> : null}
      {!topology ? <Panel><Spinner label="Reading control-plane topology" /></Panel> : (
        <DetailLayout aside={<CoreRail onRefresh={() => void refresh()} pending={pending} topology={topology} />}>
          <DetailHeader
            actions={<Button disabled={Boolean(pending)} iconStart="refresh" loading={pending === 'refresh'} onClick={() => void refresh()} size="sm" variant="secondary">Refresh</Button>}
            subtitle="The API that serves this console is a control-plane member, not a managed Docker server. It has no implicit local Docker or host-provisioning access."
            title="Control plane"
          />

          <Panel marker="1" title="Boundary and current role">
            <Rows>
              <MetricGrid dense>
                <Metric icon="shield" label="This core" layout="inline" tone={topology.controlEnabled ? 'success' : 'warning'} value={topology.controlEnabled ? 'Active' : 'Standby'} />
                <Metric icon="server" label="Core members" layout="inline" value={String(topology.members.length)} />
                <Metric icon="layers" label="Managed agents" layout="inline" value={String(servers.length)} />
                <Metric icon="clock" label="Handoff" layout="inline" tone={handoff ? 'warning' : 'neutral'} value={handoff ? handoff.state : 'None'} />
              </MetricGrid>
              <Facts items={[
                { label: 'Local control-plane ID', mono: true, value: topology.localId },
                { label: 'Declared active core', mono: true, value: topology.activeId || 'No active core while handoff is fenced' },
                { label: 'Agent boundary', value: 'A core host appears under Servers only after that host’s own machine agent is installed and enrolled.' },
              ]} />
              <Banner title="No implicit self-management" tone="info">This API cannot install Docker, initialise a Swarm, change UFW, or execute host changes on the computer it runs on. Those fixed operations remain available only through a separately enrolled agent, including when that agent happens to be on this same host.</Banner>
            </Rows>
          </Panel>

          <Panel marker="2" title="Core members">
            <Rows>
              <Body size="sm">A linked agent is optional. Linking one only records that the host was independently enrolled; it does not turn a core member into a managed server or grant the core host special privileges.</Body>
              <List>
                {topology.members.map((member) => <CoreMemberRow key={member.id} member={member} servers={servers} onVerify={() => {
                  if (!window.confirm(`Confirm that ${member.name} has a complete, tested encrypted controller-state restore. This only records your attestation; it does not probe or copy the standby.`)) return
                  void run(`verify-${member.id}`, () => api.verifyCoreReplica(member.id), `${member.name} is marked as restore-verified.`)
                }} pending={pending} />)}
              </List>
            </Rows>
          </Panel>

          {topology.controlEnabled ? <>
            <Panel marker="3" title="Prepare a standby core">
              <Rows>
                <Body size="sm">Register a unique standby first. Then deploy the same reviewed SwarmOps release on that host in standby mode, restore a tested encrypted copy of the complete controller state, and only then mark it verified below. SwarmOps does not copy data or secrets over an unpinned peer connection.</Body>
                <Input hint="Use a stable value such as core-manager-02. It is separate from a Docker node name and server ID." label="Core ID" onChange={(event) => setMemberID(event.target.value)} placeholder="core-manager-02" value={memberID} />
                <Input label="Display name" onChange={(event) => setName(event.target.value)} placeholder="Manager 02 control plane" value={name} />
                <Input hint="HTTPS is required outside local development. This is a status identity, not a remote shell endpoint." label="Standby HTTPS endpoint" onChange={(event) => setEndpoint(event.target.value)} placeholder="https://swarmops-standby.example.com" value={endpoint} />
                <Select label="Optional independently enrolled agent" onChange={(event) => setAgentServerID(event.target.value)} options={servers.map((server) => ({ label: `${server.name} · ${server.host}`, value: server.id }))} placeholder="No agent link" value={agentServerID} />
                <Inline><Button disabled={Boolean(pending) || !memberID.trim() || !name.trim() || !endpoint.trim()} loading={pending === 'replica'} onClick={addReplica} variant="accent">Prepare standby</Button></Inline>
              </Rows>
            </Panel>

            <HandoffPanel
              fenceConfirmation={fenceConfirmation}
              handoff={handoff}
              handoffTarget={handoffTarget}
              onFenceConfirmation={setFenceConfirmation}
              onPrepare={() => void run('handoff', () => api.prepareCoreHandoff(handoffTarget), 'Handoff prepared. Take and restore a final encrypted state copy before fencing this core.')}
              onTargetChange={setHandoffTarget}
              onFence={() => void run('fence', () => api.fenceCoreHandoff(handoff?.toId ?? ''), 'This core is fenced and has stopped managing agents. Promote the restored target only after it has the fenced state.')}
              pending={pending}
              verifiedStandbys={verifiedStandbys}
            />
          </> : <PromotionPanel
            confirmation={promotionConfirmation}
            localID={topology.localId}
            onConfirmation={setPromotionConfirmation}
            onPrimaryStopped={setPrimaryStopped}
            onPromote={() => void run('promote', () => api.promoteCore(primaryStopped), plannedPromotion ? 'Standby promoted after the fenced handoff.' : 'Standby promoted for emergency recovery.')}
            pending={pending}
            planned={plannedPromotion}
            primaryStopped={primaryStopped}
          />}
        </DetailLayout>
      )}
    </Page>
  )
}

function CoreMemberRow({ member, onVerify, pending, servers }: { member: CoreMember; onVerify: () => void; pending: string; servers: Server[] }) {
  const linkedServer = member.agentServerId ? servers.find((server) => server.id === member.agentServerId) : undefined
  const active = member.role === 'active'
  return (
    <ListRow
      leading={<Icon name={active ? 'shield' : 'server'} size="sm" tone={active ? 'success' : undefined} />}
      subtitle={<Rows gap="tight"><Mono>{member.id}</Mono><span>{member.endpoint || 'Endpoint not configured'}</span>{linkedServer ? <span>Explicit agent link: {linkedServer.name}</span> : <span>No agent link</span>}</Rows>}
      title={<Inline><strong>{member.name}</strong><Badge dot variant={active ? 'success' : member.replicaState === 'verified' ? 'info' : 'warning'}>{active ? 'Active' : member.replicaState === 'verified' ? 'Restore verified' : 'Awaiting restore'}</Badge></Inline>}
      trailing={!active && member.replicaState !== 'verified' ? <Button disabled={Boolean(pending)} loading={pending === `verify-${member.id}`} onClick={onVerify} size="sm" variant="secondary">Mark restore verified</Button> : member.lastCheckpointAt ? <span>{formatDateTime(member.lastCheckpointAt)}</span> : undefined}
    />
  )
}

function HandoffPanel({ fenceConfirmation, handoff, handoffTarget, onFence, onFenceConfirmation, onPrepare, onTargetChange, pending, verifiedStandbys }: {
  fenceConfirmation: string
  handoff?: CoreTopology['handoff']
  handoffTarget: string
  onFence: () => void
  onFenceConfirmation: (value: string) => void
  onPrepare: () => void
  onTargetChange: (value: string) => void
  pending: string
  verifiedStandbys: CoreMember[]
}) {
  if (!handoff) {
    return (
      <Panel marker="4" title="Plan a controlled handoff">
        <Rows>
          <Body size="sm">A planned move is a four-part safety boundary: prepare the verified target, take a final encrypted backup, restore it on the standby, then fence this core and promote that restored copy. This panel records and gates those control-plane transitions; it never SSHes into a host or copies secrets.</Body>
          <Select label="Verified standby target" onChange={(event) => onTargetChange(event.target.value)} options={verifiedStandbys.map((member) => ({ label: `${member.name} · ${member.id}`, value: member.id }))} placeholder="Verify a standby first" value={handoffTarget} />
          {!verifiedStandbys.length ? <Banner title="No verified standby" tone="warning">Register a standby, restore a complete encrypted controller-state copy to it, and record that verification before preparing a handoff.</Banner> : <Button disabled={Boolean(pending) || !handoffTarget} loading={pending === 'handoff'} onClick={onPrepare} variant="accent">Prepare handoff</Button>}
        </Rows>
      </Panel>
    )
  }
  if (handoff.state === 'prepared') {
    const expected = `FENCE_CORE:${handoff.toId}`
    return (
      <Panel marker="4" title="Fence the current core">
        <Rows>
          <Banner title="Final state copy required" tone="warning">The target must receive the final encrypted controller-state copy after this handoff was prepared and again after fencing. Do not promote a stale replica.</Banner>
          <Facts items={[{ label: 'From', mono: true, value: handoff.fromId }, { label: 'To', mono: true, value: handoff.toId }, { label: 'Prepared', value: formatDateTime(handoff.preparedAt) }]} />
          <Input hint="This stops the local command worker and all new agent or cluster actions. It cannot undo a command that is already running." label="Fence confirmation" onChange={(event) => onFenceConfirmation(event.target.value)} placeholder={expected} value={fenceConfirmation} />
          <Button disabled={Boolean(pending) || fenceConfirmation !== expected} loading={pending === 'fence'} onClick={onFence} variant="danger">Fence current core</Button>
        </Rows>
      </Panel>
    )
  }
  return <Panel marker="4" title="Core fenced"><Banner title="Promotion is now external to this core" tone="warning">This member is fenced. Restore this exact fenced controller state to <Mono>{handoff.toId}</Mono>, open its control-plane page, and promote it there.</Banner></Panel>
}

function PromotionPanel({ confirmation, localID, onConfirmation, onPrimaryStopped, onPromote, pending, planned, primaryStopped }: {
  confirmation: string
  localID: string
  onConfirmation: (value: string) => void
  onPrimaryStopped: (value: boolean) => void
  onPromote: () => void
  pending: string
  planned: boolean
  primaryStopped: boolean
}) {
  const expected = `PROMOTE_CORE:${localID}`
  return (
    <Panel marker="3" title={planned ? 'Promote fenced standby' : 'Emergency promotion'}>
      <Rows>
        <Body size="sm">{planned ? 'This restored copy contains a fenced handoff to this core. Promoting it resumes the command worker and agent management here.' : 'No fenced handoff is present. Emergency promotion can recover a failed primary, but only after you have independently confirmed that the former primary is stopped or fenced.'}</Body>
        {!planned ? <Switch checked={primaryStopped} disabled={Boolean(pending)} description="I independently confirmed that the previous primary cannot still manage agents or run commands." onChange={(event) => onPrimaryStopped(event.target.checked)}>Previous primary is stopped or fenced</Switch> : null}
        <Input hint="Promotion is local: it never starts a service on another node or copies data between hosts." label="Promotion confirmation" onChange={(event) => onConfirmation(event.target.value)} placeholder={expected} value={confirmation} />
        <Button disabled={Boolean(pending) || confirmation !== expected || (!planned && !primaryStopped)} loading={pending === 'promote'} onClick={onPromote} variant="accent">Promote this core</Button>
      </Rows>
    </Panel>
  )
}

function CoreRail({ onRefresh, pending, topology }: { onRefresh: () => void; pending: string; topology: CoreTopology }) {
  const standbys = topology.members.filter((member) => member.role === 'standby')
  const verified = standbys.filter((member) => member.replicaState === 'verified')
  return (
    <Rail actions={<Button disabled={Boolean(pending)} iconStart="refresh" loading={pending === 'refresh'} onClick={onRefresh} size="sm" variant="secondary">Refresh</Button>} title="Control-plane status">
      <RailSection meta={topology.controlEnabled ? 'active' : 'standby'} title="Local role"><StatusDot tone={topology.controlEnabled ? 'success' : 'warning'}>{topology.controlEnabled ? 'Managing agents' : 'Read-only standby'}</StatusDot></RailSection>
      <RailSection meta={`${verified.length}/${standbys.length} verified`} title="Standby readiness"><Body size="sm">A verified state is operator-attested after a complete encrypted-state restore. It is not a live remote probe.</Body></RailSection>
      <RailSection meta={topology.handoff?.state ?? 'none'} title="Handoff"><Body size="sm">{topology.handoff ? `${topology.handoff.fromId} → ${topology.handoff.toId}` : 'No controlled move is in progress.'}</Body></RailSection>
      <RailSection meta="separate" title="Server inventory"><Body size="sm">Core members do not appear in Servers. Only independently enrolled agents do.</Body></RailSection>
    </Rail>
  )
}

function formatDateTime(value?: string) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'
}

function messageOf(reason: unknown) { return reason instanceof Error ? reason.message : 'Unexpected control-plane operation failure' }
