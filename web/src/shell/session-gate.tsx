import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  AuthScreen,
  Banner,
  Body,
  Button,
  CodeBlock,
  Input,
  Stack as Rows,
  TaskProgress,
} from '@nim.zone/ui'
import { api } from '../data/api'
import type { Session } from '../data/types'
import { messageOf } from '../lib/errors'
import { Brand } from '../components/brand'
import { LoadingScreen } from '../components/loading-screen'
import { AGENT_INSTALL_URL } from './enrollment'
import { Console } from './console'

/**
 * Everything that happens before there is a console: is there a session, and
 * if not, what are the two things a person at this screen could be trying to
 * do — sign in, or connect the first server they will sign in to operate.
 */
export function SessionGate() {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    void api.me().then(setSession).catch(() => setSession(null)).finally(() => setChecking(false))
  }, [])

  if (checking) return <LoadingScreen label="Checking the operator session" />
  if (!session) return <LoginScreen onLogin={setSession} />
  return <Console onLogout={() => setSession(null)} session={session} />
}

function LoginScreen({ onLogin }: { onLogin: (session: Session) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [showAgentSetup, setShowAgentSetup] = useState(false)

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    setError('')
    setPending(true)
    try {
      onLogin(await api.login(username, password))
    } catch (reason) {
      setError(messageOf(reason))
    } finally {
      setPending(false)
    }
  }

  if (showAgentSetup) return <AgentSetupScreen onBack={() => setShowAgentSetup(false)} />

  return (
    <main className="swarmops-auth-page">
      <form onSubmit={submit}>
        <AuthScreen
          action={{ disabled: !username || !password, label: 'Sign in to SwarmOps', loading: pending, onClick: submit }}
          brand={<Brand size="lg" />}
          footer={
            <Rows gap="tight">
              <span>Use the configured operator account.</span>
              <Button onClick={() => setShowAgentSetup(true)} size="sm" type="button" variant="ghost">Install and connect a server</Button>
            </Rows>
          }
          subtitle="Audited operations for remote Docker Swarm servers."
          title="Remote operations, with a boundary."
        >
          <Input
            autoComplete="username"
            iconStart="user"
            label="Username"
            onChange={(event) => setUsername(event.target.value)}
            required
            value={username}
          />
          <Input
            autoComplete="current-password"
            error={error}
            label="Password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </AuthScreen>
      </form>
    </main>
  )
}

/**
 * The first server, explained to somebody who has not signed in yet.
 *
 * It is reachable from the sign-in screen deliberately: the operator standing
 * at a fresh controller has to run something on a host BEFORE the console has
 * anything to show them, and hiding that behind authentication makes the
 * product look like it does nothing until it is already set up.
 */
function AgentSetupScreen({ onBack }: { onBack: () => void }) {
  const [coreFingerprint, setCoreFingerprint] = useState('')
  const [identityError, setIdentityError] = useState('')

  useEffect(() => {
    void api.agentIdentity().then((identity) => {
      setCoreFingerprint(identity.coreFingerprint ?? '')
      setIdentityError(identity.coreFingerprint ? '' : 'The controller did not publish its TLS fingerprint.')
    }).catch((reason) => setIdentityError(messageOf(reason)))
  }, [])

  const command = coreFingerprint
    ? `curl --fail --show-error --location '${AGENT_INSTALL_URL}' | sudo bash -s -- --core '${window.location.origin}' --core-fingerprint '${coreFingerprint}'`
    : 'Reading the pinned controller identity…'

  return (
    <main className="swarmops-auth-page">
      <AuthScreen
        action={{ label: 'I have the code — sign in to approve it', onClick: onBack }}
        back={{ label: 'Back to sign in', onClick: onBack }}
        brand={<Brand size="lg" />}
        subtitle="Run one command on Ubuntu, then sign in and approve the short-lived code it prints."
        title="Connect your first server"
      >
        <Rows gap="tight">
          {identityError ? <Banner title="Pinned controller identity unavailable" tone="danger">{identityError}</Banner> : null}
          <CodeBlock label="Ubuntu 22.04 or 24.04" wrap>{command}</CodeBlock>
          <Body size="sm">The agent creates its private key locally and waits for approval. It then receives a renewable client certificate and connects to the controller with outbound HTTPS long polls. No inbound agent port, SSH access, Docker socket proxy, or long-lived printed key is required.</Body>
          <TaskProgress
            steps={[
              { id: 'install', label: 'Run the command on the host', status: 'active' },
              { id: 'approve', label: 'Sign in and approve its code in Fleet → Servers', status: 'pending' },
              { id: 'connect', label: 'Watch compatibility and host health appear', status: 'pending' },
            ]}
            title="Install-first enrollment"
          />
        </Rows>
      </AuthScreen>
    </main>
  )
}
