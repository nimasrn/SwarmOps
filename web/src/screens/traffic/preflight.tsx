import {
  Banner,
  Body,
  Button,
  CodeBlock,
  Inline,
  List,
  ListRow,
  Panel,
  Stack as Rows,
  StatusDot,
} from '@nim.zone/ui'
import type { Command, TraefikInstallPreflight } from '../../data/types'
import { commandFailed, normalizeDashboardHostname, validDashboardHostname } from './lib'


export function TraefikPreflightPanel({ command, credentials, dashboardHost, error, onRepair, preflight, repairing }: { command: Command | null; credentials: { password: string; username: string } | null; dashboardHost: string; error: string; onRepair: () => void; preflight: TraefikInstallPreflight; repairing: boolean }) {
  const repairBlockers = preflight.checks.filter((check) => check.required && check.state === 'blocked').length
  const dashboardHostReady = validDashboardHostname(dashboardHost)
  const blockers = repairBlockers + (dashboardHostReady ? 0 : 1)
  const ready = preflight.ready && dashboardHostReady
  return (
    <Panel caption={`Certificate challenge: ${preflight.challenge.toUpperCase()}`} title="Installation prerequisites">
      <Rows gap="tight">
        {/* A count is only a heading when there is something to count. "0
            required items incomplete" reads as a fault when it is the opposite,
            which is why the ready case states the conclusion instead. */}
        <Banner title={ready ? 'Every prerequisite is met' : blockers ? `${blockers} required item${blockers === 1 ? '' : 's'} incomplete` : 'Not ready to install'} tone={ready ? 'success' : 'warning'}>
          DNS provider credentials are optional. When no usable Cloudflare or ArvanCloud credential exists, SwarmOps renders HTTP-01 automatically. Wildcard certificates still require DNS-01.
        </Banner>
        <List plain><ListRow subtitle={dashboardHostReady ? `${normalizeDashboardHostname(dashboardHost)} will route the protected dashboard.` : 'Enter a valid public hostname in the installation panel.'} title="Dashboard hostname" trailing={<StatusDot tone={dashboardHostReady ? 'success' : 'danger'}>{dashboardHostReady ? 'ready' : 'blocked'}</StatusDot>} />{preflight.checks.map((check) => <ListRow key={check.id} subtitle={`${check.detail}${check.recovery ? ` ${check.recovery}` : ''}`} title={check.label} trailing={<StatusDot tone={check.state === 'ready' ? 'success' : check.state === 'blocked' ? 'danger' : check.state === 'automatic' ? 'accent' : 'neutral'}>{check.state === 'automatic' ? 'Created during install' : check.state}</StatusDot>} />)}</List>
		{error ? <Banner title="Automatic repair could not start" tone="danger">{error}</Banner> : null}
		{command && command.state !== 'succeeded' && !commandFailed(command) ? <Banner title="Fixing prerequisites" tone="info">Run {command.id.slice(0, 12)} is {command.state.replaceAll('_', ' ')}. SwarmOps is applying only the reviewed missing resources.</Banner> : null}
		{command && commandFailed(command) ? <Banner title="Prerequisite repair needs attention" tone="danger">{command.failureSummary ?? command.lastError ?? 'SwarmOps could not confirm every repair.'}</Banner> : null}
		{credentials ? <Banner title="Save the generated dashboard login" tone={command?.state === 'succeeded' ? 'success' : 'warning'}><Rows gap="tight"><Body size="sm">This password is shown only for this repair response. It is stored in Swarm as a write-only htpasswd secret.</Body><CodeBlock label="Traefik dashboard login" wrap>{`Username: ${credentials.username}\nPassword: ${credentials.password}`}</CodeBlock></Rows></Banner> : null}
		{!preflight.ready && preflight.repairable && repairBlockers > 0 ? <Button disabled={repairing} loading={repairing} onClick={onRepair} variant="accent">{repairBlockers === 1 ? 'Fix the missing prerequisite' : `Fix all ${repairBlockers} prerequisites`}</Button> : null}
        {!preflight.ready && !preflight.repairable ? <Inline><Button onClick={() => window.location.hash = 'nodes'} size="sm" variant="secondary">Swarm placement</Button><Button onClick={() => window.location.hash = 'resources'} size="sm" variant="secondary">Docker resources</Button></Inline> : null}
      </Rows>
    </Panel>
  )
}
