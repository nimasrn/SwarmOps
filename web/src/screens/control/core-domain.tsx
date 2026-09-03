import { useEffect, useState } from 'react'
import {
  Badge,
  Banner,
  Body,
  Button,
  Columns,
  Facts,
  Inline,
  Input,
  Mono,
  Panel,
  Select,
  Spinner,
  Stack as Rows,
  Switch,
  useToast,
} from '@nim.zone/ui'
import { api } from '../../data/api'
import type { CoreConsolePlan, CoreConsoleStatus } from '../../data/types'
import { ConfirmPhrase } from '../../components/confirm-phrase'
import { messageOf } from '../../lib/errors'

type Toast = ReturnType<typeof useToast>

/**
 * The console's own domain.
 *
 * Every application on this cluster reaches its hostname the same way — accept
 * the zone, create the record, assign the route — and the one thing that could
 * not was the console those screens are drawn on. Its name was whatever was
 * typed into SWARMOPS_HOST when the stack was deployed, and moving it meant
 * redeploying by hand.
 *
 * So the operator picks a name under a zone this gateway already accepted, and
 * the controller does the rest: the A record at the provider, the certificate
 * resolver that matches the credential, the public route, and the propagation
 * proof before that route goes live. It is not a second routing mechanism —
 * the published console appears in Traffic → Routes like anything else.
 */
export function CoreConsoleDomainPanel({ toast }: { toast: Toast }) {
  const [status, setStatus] = useState<CoreConsoleStatus | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState('')
  const [plan, setPlan] = useState<CoreConsolePlan | null>(null)
  const [adopt, setAdopt] = useState(false)
  const [address, setAddress] = useState('')
  const [credentialID, setCredentialID] = useState('')
  const [label, setLabel] = useState('')
  const [zone, setZone] = useState('')

  const read = async () => {
    try {
      const next = await api.coreConsole()
      setStatus(next)
      setError('')
      setZone((current) => current || next.zones[0] || '')
      setLabel((current) => current || next.label)
      setCredentialID((current) => current || next.credentials[0]?.id || '')
      setAddress((current) => current || next.address || '')
    } catch (reason) {
      setError(messageOf(reason))
    }
  }
  useEffect(() => { void read() }, [])

  // A plan is only ever true of the values it was read for. Changing any of
  // them drops it rather than leaving a confirmation attached to a hostname
  // the operator has since edited.
  const edit = (apply: () => void) => { setPlan(null); apply() }

  const request = { address: address.trim(), adopt, confirmation: '', credentialId: credentialID, label: label.trim(), zone }
  const host = zone ? [label.trim(), zone].filter(Boolean).join('.') : ''

  const preview = async () => {
    setPending('plan')
    try {
      setPlan(await api.planCoreConsole(request))
    } catch (reason) {
      setPlan(null)
      toast({ duration: 0, message: messageOf(reason), tone: 'danger' })
    } finally {
      setPending('')
    }
  }

  const publish = async (confirmation: string) => {
    setPending('publish')
    try {
      const command = await api.publishCoreConsole({ ...request, confirmation })
      toast({ message: `Console publication queued (${command.id.slice(0, 12)}). The controller task restarts to take the route.`, tone: 'success' })
      setPlan(null)
      await read()
    } catch (reason) {
      toast({ duration: 0, message: messageOf(reason), tone: 'danger' })
    } finally {
      setPending('')
    }
  }

  if (error) {
    return (
      <Panel title="Console domain">
        <Banner title="No gateway is selected" tone="neutral">
          {error} The console is published by a cluster's gateway, so select the cluster that runs Traefik before naming it.
        </Banner>
      </Panel>
    )
  }
  if (!status) return <Panel title="Console domain"><Spinner label="Reading the console publication" /></Panel>
  if (status.blocked) {
    return (
      <Panel title="Console domain">
        <Banner title="This console cannot be published from here" tone="warning">{status.blocked}</Banner>
      </Panel>
    )
  }

  return (
    <Panel
      description="Choose a name under a zone this gateway already accepted. SwarmOps creates the DNS record, proves it resolves, picks the certificate resolver that matches the credential, and publishes the route."
      title="Console domain"
    >
      <Rows>
        {status.published && status.host ? (
          <Facts
            items={[
              { label: 'Published at', value: <Mono>{status.url ?? `https://${status.host}/`}</Mono> },
              { label: 'Certificate resolver', value: status.resolver ?? 'None' },
              { label: 'Gateway address', value: <Mono>{status.address || 'Not recorded'}</Mono> },
            ]}
          />
        ) : (
          <Body size="sm" tone="muted">
            This console has no domain of its own yet. It is reached on whatever address you open it with today.
          </Body>
        )}

        {!status.zones.length ? (
          <Banner title="No accepted domain" tone="warning">
            Accept the apex zone on Traffic → DNS first. A gateway publishes nothing under a zone it was never given.
          </Banner>
        ) : !status.credentials.length ? (
          <Banner title="No validated DNS credential" tone="warning">
            The record is written at the provider, so a validated credential for that zone is required. Add one on Traffic → DNS.
          </Banner>
        ) : (
          <Rows>
            <Columns>
              <Select
                hint="Only zones this gateway has accepted."
                label="Zone"
                onChange={(event) => edit(() => setZone(event.target.value))}
                options={status.zones.map((value) => ({ label: value, value }))}
                value={zone}
              />
              <Input
                autoCapitalize="none"
                hint={host ? `The console will answer on ${host}.` : 'Leave empty to publish on the apex zone itself.'}
                label="Name"
                onChange={(event) => edit(() => setLabel(event.target.value))}
                placeholder="swarmops"
                spellCheck={false}
                value={label}
              />
            </Columns>
            <Columns>
              <Select
                label="Provider credential"
                onChange={(event) => edit(() => setCredentialID(event.target.value))}
                options={status.credentials.map((credential) => ({ label: `${credential.name} · ${credential.provider}`, value: credential.id }))}
                value={credentialID}
              />
              <Input
                hint="Derived from the manager Traefik runs on. Override it when this gateway is reached on a different address."
                label="Gateway IPv4 address"
                onChange={(event) => edit(() => setAddress(event.target.value))}
                placeholder="203.0.113.10"
                value={address}
              />
            </Columns>
            <Switch
              checked={adopt}
              description="Required before SwarmOps may change a record for this name that it did not create."
              onChange={(event) => edit(() => setAdopt(event.target.checked))}
            >
              Adopt an existing record
            </Switch>
            <Inline>
              <Button
                disabled={Boolean(pending) || !zone || !credentialID}
                loading={pending === 'plan'}
                onClick={() => void preview()}
                variant="secondary"
              >
                Read provider &amp; preview
              </Button>
            </Inline>

            {plan ? (
              <Rows gap="tight">
                <Facts
                  items={[
                    { label: 'Hostname', value: <Mono>{plan.host}</Mono> },
                    { label: 'Record', value: <Inline gap="tight"><Badge>{plan.record.type}</Badge><Mono>{plan.address}</Mono><Badge variant={plan.recordAction === 'noop' ? 'info' : 'warning'}>{plan.recordAction}</Badge></Inline> },
                    { label: 'Certificate resolver', value: plan.resolver },
                    { label: 'Console URL', value: <Mono>{plan.url}</Mono> },
                  ]}
                />
                {plan.warnings.map((warning) => <Body key={warning} size="sm">{warning}</Body>)}
                <ConfirmPhrase
                  action="Publish console domain"
                  busy={pending === 'publish'}
                  consequence={`${plan.host} is created at the provider and routed to this controller. The controller task is replaced to receive the route, so this console is briefly unavailable and returns on the new name.`}
                  onConfirm={publish}
                  phrase={plan.confirmation}
                />
              </Rows>
            ) : null}
          </Rows>
        )}
      </Rows>
    </Panel>
  )
}
