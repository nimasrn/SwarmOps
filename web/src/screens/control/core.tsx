import { useEffect, useMemo, useState } from 'react'
import {
  Banner,
  Body,
  Button,
  Columns,
  DataTable,
  DetailLayout,
  Facts,
  Inline,
  Input,
  Mono,
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
import type { TableColumn } from '@nim.zone/ui'
import { api } from '../../data/api'
import type { CoreMember, CoreTopology, Server } from '../../data/types'
import { Screen } from '../../components/screen'
import { CoreIdentityPanels } from './core-identity'
import { RegistryMirrorPanel } from './registry-mirror'
import { formatDateTime } from '../../lib/format'
import { messageOf } from '../../lib/errors'

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
  const timeline = useMemo(() => {
    const prepared = Boolean(handoff)
    const fenced = handoff?.state === 'fenced'
    return [
      ['Register standby', standbys.length > 0, 'Standby identity and endpoint recorded'],
      ['Restore encrypted state', verifiedStandbys.length > 0, 'Operator-attested restore verification'],
      ['Select target', prepared, handoff?.toId ?? 'No handoff target selected'],
      ['Prepare handoff', prepared, prepared ? 'Authority movement recorded' : 'Waiting for a verified target'],
      ['Freeze new mutations', fenced, fenced ? 'Current controller fenced' : 'Pending explicit fence'],
      ['Drain command leases', fenced, fenced ? 'No new leases issued here' : 'Runs at the fencing boundary'],
      ['Final encrypted snapshot', fenced, fenced ? 'Copy the fenced controller state' : 'Required before promotion'],
      ['Promote target', plannedPromotion && Boolean(topology?.controlEnabled), plannedPromotion ? 'Target is eligible for local promotion' : 'Pending on target controller'],
      ['Health burn-in', false, 'Verify the promoted controller independently'],
      ['Retain rollback', false, 'Keep the previous encrypted state until verified'],
    ].map(([stage, complete, evidence], index) => ({ complete: Boolean(complete), evidence: String(evidence), id: index + 1, stage: String(stage) }))
  }, [handoff, plannedPromotion, standbys.length, topology?.controlEnabled, verifiedStandbys.length])

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
      setError('Enter a controller ID, display name, and HTTPS endpoint before preparing a standby.')
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
    <Screen
      about="The controller is host-native, Docker-free, and movable inside or outside the cluster. It never appears as a managed node unless a separate agent is enrolled for that host."
      actions={
        <Inline>
          <Button disabled={!verifiedStandbys.length || Boolean(pending)} onClick={() => document.getElementById('core-movement')?.scrollIntoView({ behavior: 'smooth' })} variant="accent">Move controller</Button>
          <Button disabled={Boolean(pending)} iconStart="refresh" loading={pending === 'refresh'} onClick={() => void refresh()} variant="secondary">Re-read topology</Button>
          <Button onClick={() => { window.location.hash = 'logs' }} variant="ghost">Open controller logs</Button>
        </Inline>
      }
      insights={topology ? [
        { hint: topology.controlEnabled ? 'This controller owns the active authority epoch, so changes may be made' : 'Every mutation is fenced until this controller holds authority', icon: 'shield', label: 'Authority', tone: topology.controlEnabled ? 'success' : 'warning', value: topology.controlEnabled ? 'Held here' : 'Standby' },
        { hint: 'Increments on every authority movement; every run records the term it ran under', icon: 'hash', label: 'Authority term', value: String(topology.authorityEpoch) },
        { hint: verifiedStandbys.length ? 'Standbys with an operator-attested encrypted restore' : 'No standby can receive authority yet', icon: 'server', label: 'Verified standbys', tone: verifiedStandbys.length ? 'success' : 'warning', value: `${verifiedStandbys.length} / ${standbys.length}` },
        { hint: handoff ? `A handoff is ${handoff.state}` : 'No authority movement is in progress', icon: 'arrow-forward', label: 'Handoff', tone: handoff ? 'accent' : 'neutral', value: handoff ? handoff.state : 'None' },
      ] : undefined}
      meta={topology ? (
        <Inline>
          <span>Controller identity <Mono>{topology.localId}</Mono></span>
          <span>Role <StatusDot tone={topology.controlEnabled ? 'success' : 'warning'}>{topology.localRole}</StatusDot></span>
        </Inline>
      ) : undefined}
      page="core"
      width="full"
    >
      {error ? <Banner title="Control-plane action needs attention" tone="danger">{error}</Banner> : null}

      {/* What this controller IS comes first. The move procedure below is the
          thing you do once a year; the version, the host and the disk are the
          things you came to look at. */}
      <CoreIdentityPanels toast={toast} />

      {/* Where images come from is a fleet-wide fact, so it is decided here
          and not once per machine on the Servers screen. */}
      <RegistryMirrorPanel toast={toast} />

      {!topology ? <Panel><Spinner label="Reading control-plane topology" /></Panel> : (
        <>
          <DetailLayout aside={<CoreRail onRefresh={() => void refresh()} pending={pending} topology={topology} />}>
          <Panel flush title="Controller members">
            <DataTable columns={coreMemberColumns(topology, servers, pending, (member) => {
              if (!window.confirm(`Confirm that ${member.name} has a complete, tested encrypted controller-state restore. This only records your attestation; it does not probe or copy the standby.`)) return
              void run(`verify-${member.id}`, () => api.verifyCoreReplica(member.id), `${member.name} is marked as restore-verified.`)
            })} rowKey={(member) => member.id} rows={topology.members} />
          </Panel>

          <Panel actions={<Inline><span>One-active-controller authority term: <Mono>{String(topology.authorityEpoch)}</Mono></span><span>Lease TTL: bounded</span></Inline>} flush title="Planned move timeline">
            <DataTable columns={[
              { header: '#', key: 'id', render: (item) => item.id },
              { header: 'Stage', key: 'stage', render: (item) => item.stage },
              { header: 'State', key: 'state', render: (item) => <StatusDot tone={item.complete ? 'success' : 'neutral'}>{item.complete ? 'Complete' : 'Pending'}</StatusDot> },
              { header: 'Evidence', key: 'evidence', render: (item) => item.evidence },
              { header: 'Rollback boundary', key: 'boundary', render: (item) => item.id === 5 ? <span className="nim-tone-success">Exact authority boundary</span> : item.id < 5 ? 'Before fencing' : 'After promotion' },
            ] satisfies TableColumn<(typeof timeline)[number]>[]} rowKey={(item) => String(item.id)} rows={timeline} />
          </Panel>

          <Panel title="Install new controller standby">
            <Body size="sm">Register the target identity and pinned HTTPS endpoint. SwarmOps never copies controller state or secrets to a peer automatically.</Body>
            <Columns>
              <Input label="Controller ID" onChange={(event) => setMemberID(event.target.value)} placeholder="controller-manager-02" value={memberID} />
              <Input label="Display name" onChange={(event) => setName(event.target.value)} placeholder="Controller 02" value={name} />
              <Input label="Standby HTTPS endpoint" onChange={(event) => setEndpoint(event.target.value)} placeholder="https://swarmops-standby.example.com" value={endpoint} />
            </Columns>
            <Inline><Select label="Optional enrolled agent" onChange={(event) => setAgentServerID(event.target.value)} options={servers.map((server) => ({ label: `${server.name} · ${server.host}`, value: server.id }))} placeholder="No agent link" value={agentServerID} /><Button disabled={Boolean(pending) || !memberID.trim() || !name.trim() || !endpoint.trim()} loading={pending === 'replica'} onClick={addReplica} variant="accent">Prepare standby</Button></Inline>
          </Panel>

          {topology.controlEnabled ? <>
            <div id="core-movement"><HandoffPanel
              fenceConfirmation={fenceConfirmation}
              handoff={handoff}
              handoffTarget={handoffTarget}
              onFenceConfirmation={setFenceConfirmation}
              onPrepare={() => void run('handoff', () => api.prepareCoreHandoff(handoffTarget), 'Handoff prepared. Take and restore a final encrypted state copy before fencing this controller.')}
              onTargetChange={setHandoffTarget}
              onFence={() => void run('fence', () => api.fenceCoreHandoff(handoff?.toId ?? ''), 'This controller is fenced and has stopped managing agents. Promote the restored target only after it has the fenced state.')}
              pending={pending}
              verifiedStandbys={verifiedStandbys}
            /></div>
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
        </>
      )}
    </Screen>
  )
}

function coreMemberColumns(topology: CoreTopology, servers: Server[], pending: string, onVerify: (member: CoreMember) => void): TableColumn<CoreMember>[] {
  return [
    { header: 'Role', key: 'role', render: (member) => <StatusDot tone={member.role === 'active' ? 'success' : 'neutral'}>{member.role === 'active' ? 'Active' : 'Standby'}</StatusDot> },
    { header: 'Host', key: 'host', render: (member) => member.name },
    { header: 'Endpoint', key: 'endpoint', render: (member) => <Mono>{member.endpoint || 'Not configured'}</Mono> },
    { header: 'State', key: 'state', render: (member) => member.role === 'active' ? 'Serving' : member.replicaState === 'verified' ? 'Restore verified' : 'Awaiting restore' },
    { header: 'Agent', key: 'agent', render: (member) => member.agentServerId ? servers.find((server) => server.id === member.agentServerId)?.name ?? member.agentServerId : 'No agent' },
    { header: 'Checkpoint', key: 'checkpoint', render: (member) => formatDateTime(member.lastCheckpointAt) },
    { header: 'Actions', key: 'actions', render: (member) => member.role !== 'active' && member.replicaState !== 'verified' ? <Button disabled={Boolean(pending)} loading={pending === `verify-${member.id}`} onClick={() => onVerify(member)} size="sm" variant="secondary">Verify restore</Button> : '•••' },
  ]
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
          <Body size="sm">A planned move is a four-part safety boundary: prepare the verified target, take a final encrypted backup, restore it on the standby, then fence this controller and promote that restored copy. This panel records and gates those control-plane transitions; it never SSHes into a host or copies secrets.</Body>
          <Select label="Verified standby target" onChange={(event) => onTargetChange(event.target.value)} options={verifiedStandbys.map((member) => ({ label: `${member.name} · ${member.id}`, value: member.id }))} placeholder="Verify a standby first" value={handoffTarget} />
          {!verifiedStandbys.length ? <Banner title="No verified standby" tone="warning">Register a standby, restore a complete encrypted controller-state copy to it, and record that verification before preparing a handoff.</Banner> : <Button disabled={Boolean(pending) || !handoffTarget} loading={pending === 'handoff'} onClick={onPrepare} variant="accent">Prepare handoff</Button>}
        </Rows>
      </Panel>
    )
  }
  if (handoff.state === 'prepared') {
    const expected = `FENCE_CORE:${handoff.toId}`
    return (
      <Panel marker="4" title="Fence the current controller">
        <Rows>
          <Banner title="Final state copy required" tone="warning">The target must receive the final encrypted controller-state copy after this handoff was prepared and again after fencing. Do not promote a stale replica.</Banner>
          <Facts items={[{ label: 'From', mono: true, value: handoff.fromId }, { label: 'To', mono: true, value: handoff.toId }, { label: 'Prepared', value: formatDateTime(handoff.preparedAt) }]} />
          <Input hint="This stops the local command worker and all new agent or cluster actions. It cannot undo a command that is already running." label="Fence confirmation" onChange={(event) => onFenceConfirmation(event.target.value)} placeholder={expected} value={fenceConfirmation} />
          <Button disabled={Boolean(pending) || fenceConfirmation !== expected} loading={pending === 'fence'} onClick={onFence} variant="danger">Fence current controller</Button>
        </Rows>
      </Panel>
    )
  }
  return <Panel marker="4" title="Controller fenced"><Banner title="Promotion is now external to this controller" tone="warning">This member is fenced. Restore this exact fenced controller state to <Mono>{handoff.toId}</Mono>, open its control-plane page, and promote it there.</Banner></Panel>
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
        <Body size="sm">{planned ? 'This restored copy contains a fenced handoff to this controller. Promoting it resumes the command worker and agent management here.' : 'No fenced handoff is present. Emergency promotion can recover a failed primary, but only after you have independently confirmed that the former primary is stopped or fenced.'}</Body>
        {!planned ? <Switch checked={primaryStopped} disabled={Boolean(pending)} description="I independently confirmed that the previous primary cannot still manage agents or run commands." onChange={(event) => onPrimaryStopped(event.target.checked)}>Previous primary is stopped or fenced</Switch> : null}
        <Input hint="Promotion is local: it never starts a service on another node or copies data between hosts." label="Promotion confirmation" onChange={(event) => onConfirmation(event.target.value)} placeholder={expected} value={confirmation} />
        <Button disabled={Boolean(pending) || confirmation !== expected || (!planned && !primaryStopped)} loading={pending === 'promote'} onClick={onPromote} variant="accent">Promote this controller</Button>
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
      <RailSection meta="separate" title="Server inventory"><Body size="sm">Controller members do not appear in Servers. Only independently enrolled agents do.</Body></RailSection>
    </Rail>
  )
}
