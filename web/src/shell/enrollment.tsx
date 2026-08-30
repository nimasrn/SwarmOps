import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Banner,
  Body,
  Button,
  CodeBlock,
  Input,
  Panel,
  Stack as Rows,
  useToast,
} from '@nim.zone/ui'
import { api } from '../data/api'
import type { AgentEnrollmentToken } from '../data/types'
import { formatDateTime } from '../lib/format'
import { messageOf } from '../lib/errors'

export const AGENT_INSTALL_URL = 'https://github.com/nimasrn/SwarmOps/releases/latest/download/install-swarmops-agent.sh'

type Toast = ReturnType<typeof useToast>

/**
 * The two ways a host joins, side by side.
 *
 * They differ only in which end starts: the controller can mint a one-time
 * grant and hand the operator a command that carries it, or the operator can
 * install first and bring back the code the agent printed. Both end at the same
 * renewable client certificate over the same outbound long poll, which is why
 * they are presented as two shapes of one step rather than as two features.
 */
export function OutboundEnrollmentGuide({ toast }: { toast: Toast }) {
  const [name, setName] = useState('')
  const [token, setToken] = useState<AgentEnrollmentToken | null>(null)
  const [pending, setPending] = useState(false)
  const secureOrigin = window.location.protocol === 'https:'

  const create = async () => {
    setPending(true)
    try {
      setToken(await api.createAgentEnrollment(name.trim()))
    } catch (reason) {
      toast({ duration: 0, message: messageOf(reason), tone: 'danger' })
    } finally {
      setPending(false)
    }
  }

  const command = token
    ? `bash -o pipefail -c "curl --fail --show-error --location '${AGENT_INSTALL_URL}' | sudo bash -s -- --core '${window.location.origin}'${token.coreFingerprint ? ` --core-fingerprint '${token.coreFingerprint}'` : ''} --enrollment-code '${token.code}' --defer-docker"`
    : ''

  return (
    <Panel eyebrow="Recommended · outbound HTTPS" title="Install and enroll with one command">
      <Rows>
        <Body size="sm">The controller creates a short-lived, one-time certificate grant. The Ubuntu agent generates its private key locally, pins this controller, installs as a systemd service, and reconnects through outbound long polls. No inbound agent port or SSH access is required.</Body>
        {!secureOrigin ? <Banner title="HTTPS is required" tone="warning">Open the production HTTPS controller URL to generate an install command. Loopback HTTP remains available only for local development.</Banner> : null}
        <Input hint="Optional. The host name is used when this is empty." label="Agent name" onChange={(event) => setName(event.target.value)} value={name} />
        <Button disabled={!secureOrigin || pending} loading={pending} onClick={() => void create()} variant="accent">Generate one-time install command</Button>
        {token ? (
          <>
            <CodeBlock label="Run once on Ubuntu 22.04 or 24.04" wrap>{command}</CodeBlock>
            <Body size="sm">Expires {formatDateTime(token.expiresAt)}. Generate another command if it expires; this code cannot be reused after enrollment.</Body>
          </>
        ) : null}
      </Rows>
    </Panel>
  )
}

export function StandaloneClaimGuide({ onApproved, toast }: { onApproved: () => Promise<void>; toast: Toast }) {
  const [code, setCode] = useState('')
  const [coreFingerprint, setCoreFingerprint] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    void api.agentIdentity()
      .then((identity) => setCoreFingerprint(identity.coreFingerprint ?? ''))
      .catch(() => setCoreFingerprint(''))
  }, [])

  const approve = async (event: FormEvent) => {
    event.preventDefault()
    setPending(true)
    try {
      const approval = await api.approveAgentClaim(code.trim())
      setCode('')
      await onApproved()
      toast({ message: `${approval.name} approved; the agent is receiving its certificate`, tone: 'success' })
    } catch (reason) {
      toast({ duration: 0, message: messageOf(reason), tone: 'danger' })
    } finally {
      setPending(false)
    }
  }

  return (
    <Panel eyebrow="Standalone · install first" title="Enter the code printed by the agent">
      <Rows as="form" onSubmit={approve}>
        <Body size="sm">Run the installer with the controller certificate pin. The agent keeps its private key and redemption secret, prints a short-lived code, and waits. Approving the code issues the same renewable client certificate as the dashboard-generated flow.</Body>
        <CodeBlock label="Install first on Ubuntu 22.04 or 24.04" wrap>
          {coreFingerprint
            ? `curl --fail --show-error --location '${AGENT_INSTALL_URL}' | sudo bash -s -- --core '${window.location.origin}' --core-fingerprint '${coreFingerprint}'`
            : 'Reading the pinned controller identity…'}
        </CodeBlock>
        <Input autoComplete="off" hint="Four groups of four characters; expires after 15 minutes." label="Agent enrollment code" onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="ABCD-EFGH-JKLM-NPQR" required value={code} />
        <Button disabled={pending || code.replaceAll('-', '').length !== 16} loading={pending} type="submit" variant="accent">Approve and enroll agent</Button>
      </Rows>
    </Panel>
  )
}
