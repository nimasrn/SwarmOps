import { useState } from 'react'
import type { FormEvent } from 'react'
import {
  Banner,
  Body,
  Button,
  CodeBlock,
  Columns,
  DataTable,
  EmptyState,
  Inline,
  Input,
  Panel,
  RecordLink,
  Sheet,
  Stack as Rows,
  useToast,
} from '@nim.zone/ui'
import type { TableColumn } from '@nim.zone/ui'
import { api } from '../../data/api'
import type { Server, ServerCredentials, ServerInput } from '../../data/types'
import { isNativeAgent, serverConnectionLabel, serverEndpointLabel } from '../../data/server-connection'
import { isServerConnected, serverCanManage, serverHealth } from '../../lib/health'
import { connectionErrorOf, messageOf, type ConnectionError } from '../../lib/errors'
import { Screen } from '../../components/screen'
import { StatusBadge } from '../../components/badges'
import { OutboundEnrollmentGuide, StandaloneClaimGuide } from '../../shell/enrollment'

type Toast = ReturnType<typeof useToast>

interface ServersPageProps {
  activeServerID: string
  onConnected: (server: Server) => Promise<void>
  onDiagnostics: (id: string) => void
  onProvision: () => void
  onRefresh: () => Promise<void>
  onSelect: (id: string) => void
  servers: Server[]
  toast: Toast
}

/**
 * The fleet, and the one command that adds to it.
 *
 * Enrollment is the whole point of the screen, so it is above the table rather
 * than behind an "Add" button: on a fresh controller the table is empty and the
 * only useful thing here is the command to run. The inbound machine-API form is
 * a MIGRATION path and now lives behind an explicit disclosure — it was
 * previously a panel of equal weight beside the two supported flows, which read
 * as three ways of doing the same thing rather than two plus a legacy one.
 */
export function ServersPage({
  activeServerID,
  onConnected,
  onDiagnostics,
  onProvision,
  onRefresh,
  onSelect,
  servers,
  toast,
}: ServersPageProps) {
  const [apiKey, setAPIKey] = useState('')
  const [apiURL, setAPIURL] = useState('')
  const [editing, setEditing] = useState<Server | null>(null)
  const [error, setError] = useState<ConnectionError | null>(null)
  const [name, setName] = useState('')
  const [pending, setPending] = useState(false)
  const [port, setPort] = useState('9180')
  const [tlsFingerprint, setTLSFingerprint] = useState('')
  const [manual, setManual] = useState(false)

  const connected = servers.filter(isServerConnected)
  const managers = servers.filter(serverCanManage)

  const reset = () => {
    setAPIKey('')
    setAPIURL('')
    setEditing(null)
    setError(null)
    setName('')
    setPort('9180')
    setTLSFingerprint('')
    setManual(false)
  }

  const beginReconnect = (server: Server) => {
    setAPIKey('')
    setAPIURL(server.apiUrl ?? '')
    setEditing(server)
    setError(null)
    setName(server.name)
    setPort(String(server.port))
    setTLSFingerprint(server.tlsCertificateFingerprint ?? '')
    setManual(true)
  }

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    const parsedPort = Number(port)
    if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      setError({ message: 'Machine API port must be between 1 and 65535.' })
      return
    }
    try {
      const parsedURL = new URL(apiURL)
      if (parsedURL.protocol !== 'https:' || parsedURL.port || parsedURL.pathname !== '/' || parsedURL.search || parsedURL.hash || parsedURL.username || parsedURL.password) {
        throw new Error('invalid')
      }
    } catch {
      setError({ message: 'Enter an HTTPS machine API origin without a port, path, query, or credentials.' })
      return
    }
    setPending(true)
    setError(null)
    const credentials: ServerCredentials = { apiKey }
    try {
      const server = editing
        ? await api.connectServer(editing.id, credentials)
        : await api.addServer({ ...credentials, apiUrl: apiURL, name, port: parsedPort, tlsCertificateFingerprint: tlsFingerprint } satisfies ServerInput)
      setAPIKey('')
      await onConnected(server)
      reset()
    } catch (reason) {
      setError(connectionErrorOf(reason))
    } finally {
      setPending(false)
    }
  }

  const disconnect = async (server: Server) => {
    try {
      await api.disconnectServer(server.id)
      if (activeServerID === server.id) onSelect('')
      await onRefresh()
      toast({ message: `${server.name} disconnected and its in-memory API key was cleared`, tone: 'success' })
    } catch (reason) {
      toast({ duration: 0, message: messageOf(reason), tone: 'danger' })
    }
  }

  const removeLegacyProfile = async (server: Server) => {
    if (!window.confirm(`Remove the legacy SSH profile for ${server.name}? Add the host again through its machine API after the agent is installed.`)) return
    try {
      await api.removeServer(server.id)
      if (activeServerID === server.id) onSelect('')
      await onRefresh()
      toast({ message: `${server.name} legacy profile removed`, tone: 'success' })
    } catch (reason) {
      toast({ duration: 0, message: messageOf(reason), tone: 'danger' })
    }
  }

  const columns: TableColumn<Server>[] = [
    { header: 'Server', key: 'server', render: (server) => <RecordLink meta={server.connectionType === 'agent_pull' ? 'Connects out securely · no inbound agent port' : serverEndpointLabel(server)} title={server.name} /> },
    { header: 'Connection', key: 'transport', render: serverConnectionLabel },
    { header: 'Docker', key: 'docker', render: (server) => server.dockerAvailable ? server.dockerVersion || 'Engine reachable' : 'Not detected' },
    { header: 'Swarm', key: 'swarm', render: (server) => server.swarmControlAvailable ? 'Manager' : server.dockerAvailable ? server.swarmState || 'Not active' : 'Bootstrap required' },
    { header: 'Agent', key: 'agent', render: (server) => server.agentHealth?.agentVersion ? `v${server.agentHealth.agentVersion.replace(/^v/, '')}` : 'Version unavailable' },
    { header: 'Status', key: 'connection', render: (server) => <StatusBadge health={serverHealth(server)} label={server.connectionState === 'connected' && serverHealth(server) === 'healthy' ? 'Connected' : server.agentHealth?.summary || (server.connectionState === 'connected' ? 'Checking connection' : 'Reconnect required')} /> },
    {
      header: 'Action',
      key: 'action',
      render: (server) => !isNativeAgent(server)
        ? <Button onClick={() => void removeLegacyProfile(server)} size="sm" variant="ghost">Remove legacy profile</Button>
        : server.connectionState === 'connected'
          ? (
            <Inline gap="tight">
              <Button onClick={() => onDiagnostics(server.id)} size="sm" variant="ghost">Diagnostics</Button>
              {serverCanManage(server)
                ? <Button onClick={() => onSelect(server.id)} size="sm" variant={activeServerID === server.id ? 'secondary' : 'ghost'}>{activeServerID === server.id ? 'Selected' : 'Use server'}</Button>
                : serverHealth(server) === 'unhealthy'
                  ? null
                  : <Button onClick={onProvision} size="sm" variant="secondary">Finish host setup</Button>}
              <Button onClick={() => void disconnect(server)} size="sm" variant="ghost">Disconnect</Button>
            </Inline>
          )
          : <Button onClick={() => beginReconnect(server)} size="sm" variant="secondary">Reconnect</Button>,
    },
  ]

  const connectionReady = Boolean(apiKey) && Boolean(apiURL) && Boolean(tlsFingerprint)

  return (
    <Screen
      about="Each server initiates an encrypted connection to SwarmOps, so no agent exposes an inbound port. The machine running this controller appears here only if you also install and enroll an agent on it."
      actions={<Button iconStart="link" onClick={() => onDiagnostics(activeServerID)} variant="secondary">Diagnose a connection</Button>}
      insights={[
        { hint: servers.length ? 'Hosts with an approved agent identity' : 'No host has completed enrollment', icon: 'server', label: 'Enrolled hosts', tone: servers.length ? 'accent' : 'neutral', value: String(servers.length) },
        { hint: connected.length ? 'Agents answering outbound long polls' : 'No agent is answering the controller', icon: 'link', label: 'Answering agents', tone: connected.length ? 'success' : 'warning', value: String(connected.length) },
        { hint: managers.length ? 'Hosts that can be selected as a cluster target' : 'Swarm control is unavailable on every host', icon: 'layers', label: 'Swarm managers', tone: managers.length ? 'success' : 'warning', value: String(managers.length) },
        { hint: servers.length - connected.length ? 'Enrolled but not currently answering' : 'Every enrolled host is answering', icon: 'alert', label: 'Not answering', tone: servers.length - connected.length ? 'danger' : 'success', value: String(servers.length - connected.length) },
      ]}
      page="servers"
      width="full"
    >
      <Columns>
        <OutboundEnrollmentGuide toast={toast} />
        <StandaloneClaimGuide onApproved={onRefresh} toast={toast} />
      </Columns>

      <Panel
        actions={<Button onClick={() => setManual(true)} size="sm" variant="ghost">Open legacy connection details</Button>}
        caption={`${servers.length} enrolled`}
        flush
        title="Managed servers"
      >
        <DataTable
          caption="Remote server profiles"
          columns={columns}
          empty={<EmptyState description="Choose either outbound enrollment flow above. The Ubuntu agent appears here after certificate issuance and its first long poll." icon="server" title="No agents connected" />}
          rowKey={(server) => server.id}
          rows={servers}
        />
      </Panel>

      {/* Migration only, and deliberately behind a disclosure. Presented beside
          the two supported flows it read as a third equal option, which is how
          a pinned inbound listener ends up being someone's first choice. */}
      <Sheet
        closeLabel="Close legacy connection details"
        onClose={reset}
        open={manual}
        title={editing ? `Reconnect ${editing.name}` : 'Existing inbound machine API'}
      >
        <Rows>
          <Banner title="This path is for migration" tone="warning">
            New agents must use one of the outbound certificate flows. Open this only to reconnect an older pinned HTTPS machine API while it is being migrated.
          </Banner>
          <Columns>
            <Rows as="form" onSubmit={submit}>
              <Input disabled={Boolean(editing)} hint="A local label only; it never affects the remote host." label="Name" onChange={(event) => setName(event.target.value)} required value={name} />
              <Input disabled={Boolean(editing)} hint="HTTPS origin only, for example https://manager.example.com. Enter its port separately." label="Machine API URL" onChange={(event) => setAPIURL(event.target.value)} required type="url" value={apiURL} />
              <Columns>
                <Input disabled={Boolean(editing)} label="Machine API port" min="1" onChange={(event) => setPort(event.target.value)} required type="number" value={port} />
                <Input disabled={Boolean(editing)} hint="Public SHA-256 fingerprint of the API certificate." label="TLS certificate fingerprint" onChange={(event) => setTLSFingerprint(event.target.value)} placeholder="SHA256:…" required value={tlsFingerprint} />
              </Columns>
              <Input autoComplete="off" hint="It is used to connect now and cleared on disconnect or API restart." label="Machine API key" onChange={(event) => setAPIKey(event.target.value)} required type="password" value={apiKey} />
              {error ? (
                <Banner title={error.message} tone="danger">
                  <Rows gap="tight">
                    {error.detail ? <p>{error.detail}</p> : null}
                    {error.requestID ? <Body size="sm">Request ID: <code>{error.requestID}</code></Body> : null}
                  </Rows>
                </Banner>
              ) : null}
              <Inline>
                <Button disabled={pending || !connectionReady || (!editing && !name)} loading={pending} type="submit" variant="accent">{editing ? 'Reconnect server' : 'Add and connect server'}</Button>
                <Button onClick={reset} type="button" variant="ghost">Cancel</Button>
              </Inline>
            </Rows>
            <Rows gap="tight">
              <p>The API key authorizes SwarmOps but does not encrypt it. Use the machine agent’s HTTPS listener and enter its public certificate fingerprint in <code>SHA256:&lt;64-hex&gt;</code> form.</p>
              <CodeBlock label="Fingerprint command" wrap>{'openssl x509 -in <agent-certificate.pem> -outform DER | openssl dgst -sha256 -hex'}</CodeBlock>
              <Body size="sm">Verify the fingerprint from the target machine’s trusted console before saving it. An enrollment token already carries this fingerprint, so this manual path is only for a host enrolled before, or for reviewed TLS material you issued yourself.</Body>
            </Rows>
          </Columns>
        </Rows>
      </Sheet>
    </Screen>
  )
}
