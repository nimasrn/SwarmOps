import { useCallback, useEffect, useState } from 'react'
import {
  Banner,
  Body,
  Button,
  Checkbox,
  Facts,
  Icon,
  Inline,
  Input,
  List,
  ListRow,
  Panel,
  Sheet,
  Spinner,
  Stack as Rows,
  StatusDot,
} from '@nim.zone/ui'
import { api } from '../../../data/api'
import { messageOf } from '../../../lib/errors'
import type { SourceSettings, SourceStatus } from '../../../data/types'

/** Where the setup steps are written up in full. */
export const SOURCE_DOCS_URL = 'https://nim.zone/docs/swarmops'

/**
 * The four things source deployment needs, and the form that sets them.
 *
 * These used to be startup environment variables the screen could only print,
 * which made setup a dead end for the one person most likely to be reading it:
 * an operator in a browser with no shell on the controller. They are now sealed
 * console settings applied without a restart, held with the same key as the
 * provider tokens. The registry password is write-only — it is accepted here
 * and never returned to this page.
 */
export function SourceSetupPanel({ onApplied, status }: { onApplied?: () => void; status: SourceStatus }) {
  const [open, setOpen] = useState(false)
  const [settings, setSettings] = useState<SourceSettings | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const [enabled, setEnabled] = useState(false)
  const [buildEnabled, setBuildEnabled] = useState(false)
  const [imagePrefix, setImagePrefix] = useState('')
  const [privateHosts, setPrivateHosts] = useState('')
  const [registryServer, setRegistryServer] = useState('')
  const [registryUsername, setRegistryUsername] = useState('')
  const [registryPassword, setRegistryPassword] = useState('')

  const adopt = useCallback((next: SourceSettings) => {
    setSettings(next)
    setEnabled(next.enabled)
    setBuildEnabled(next.buildEnabled)
    setImagePrefix(next.imagePrefix)
    setPrivateHosts((next.privateHosts ?? []).join(', '))
    setRegistryServer(next.registryServer)
    setRegistryUsername(next.registryUsername)
    setRegistryPassword('')
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      adopt(await api.sourceSettings())
    } catch (cause) {
      setError(messageOf(cause))
    } finally {
      setLoading(false)
    }
  }, [adopt])

  useEffect(() => { if (open) void load() }, [load, open])

  async function apply() {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const next = await api.saveSourceSettings({
        buildEnabled,
        enabled,
        imagePrefix: imagePrefix.trim(),
        privateHosts: privateHosts.split(',').map((host) => host.trim()).filter(Boolean),
        registryPassword: registryPassword || undefined,
        registryServer: registryServer.trim(),
        registryUsername: registryUsername.trim(),
      })
      adopt(next)
      setSaved(true)
      onApplied?.()
    } catch (cause) {
      setError(messageOf(cause))
    } finally {
      setSaving(false)
    }
  }

  const pinned = settings ? !settings.settingsEditable : false

  return (
    <>
      <Panel
        actions={<Button href={SOURCE_DOCS_URL} iconStart="document" rel="noreferrer" size="sm" target="_blank" variant="ghost">Setup guide</Button>}
        eyebrow="Setup required"
        marker={<Icon name="lock" size="sm" />}
        title="Turn on source deployment"
      >
        <Rows>
          <Body size="sm">Source deployment is off, so this controller refuses every provider call. Turn it on below and SwarmOps will connect GitHub, GitLab, Gitea, or Forgejo with a read-only token, list your projects, scan the one you choose for its Dockerfile, Compose file, and databases, map a route, then build and deploy it. Nothing here needs a shell on the controller or a restart.</Body>
          <List plain>
            <ListRow leading={<Icon name={status.enabled ? 'check-circle' : 'alert'} size="sm" tone={status.enabled ? 'success' : 'warning'} />} subtitle="Lets the controller accept source-provider connections." title="Source deployment" trailing={<StatusDot tone={status.enabled ? 'success' : 'warning'}>{status.enabled ? 'On' : 'Off'}</StatusDot>} />
            <ListRow leading={<Icon name={status.imagePrefixConfigured ? 'check-circle' : 'alert'} size="sm" tone={status.imagePrefixConfigured ? 'success' : 'warning'} />} subtitle="The one registry namespace generated application images may use." title="Registry namespace" trailing={<StatusDot tone={status.imagePrefixConfigured ? 'success' : 'warning'}>{status.imagePrefixConfigured ? 'Set' : 'Needed to build'}</StatusDot>} />
            <ListRow leading={<Icon name={status.buildEnabled ? 'check-circle' : 'alert'} size="sm" tone={status.buildEnabled ? 'success' : 'warning'} />} subtitle="Runs only the reviewed, resource-bounded build and pushes with the sealed registry credential." title="Bounded builds" trailing={<StatusDot tone={status.buildEnabled ? 'success' : 'warning'}>{status.buildEnabled ? 'On' : 'Needed to build'}</StatusDot>} />
            <ListRow leading={<Icon name={status.privateHostsConfigured ? 'check-circle' : 'info'} size="sm" tone={status.privateHostsConfigured ? 'success' : undefined} />} subtitle="Only for GitHub Enterprise, self-managed GitLab, Gitea, or Forgejo. github.com and gitlab.com need nothing here." title="Private provider hosts" trailing={<StatusDot tone={status.privateHostsConfigured ? 'success' : 'neutral'}>{status.privateHostsConfigured ? 'Set' : 'Optional'}</StatusDot>} />
          </List>
          <Inline>
            <Button onClick={() => setOpen(true)} variant="accent">Set up source deployment</Button>
            <Button href={SOURCE_DOCS_URL} rel="noreferrer" target="_blank" variant="secondary">How this works</Button>
          </Inline>
        </Rows>
      </Panel>

      <Sheet closeLabel="Close source setup" onClose={() => setOpen(false)} open={open} title="Set up source deployment">
        {loading && !settings ? <Spinner label="Reading source settings" /> : (
          <Rows>
            {error ? <Banner title="Settings were not applied" tone="danger">{error}</Banner> : null}
            {saved && !error ? <Banner title="Applied" tone="success">The controller is using these settings now. No restart is needed.</Banner> : null}
            {pinned ? <Banner title="Pinned by this controller" tone="warning">This controller was started with its source settings fixed, so they cannot be changed from the console. Ask whoever runs the host, or follow the setup guide.</Banner> : null}

            <Checkbox checked={enabled} description="Allows provider connections, project listing, and repository scanning." disabled={pinned} onChange={(event) => setEnabled(event.target.checked)}>Enable source deployment</Checkbox>

            <Input disabled={pinned || !enabled} hint="Registry host and namespace SwarmOps may push generated images to, such as ghcr.io/your-org." label="Registry namespace" onChange={(event) => setImagePrefix(event.target.value)} placeholder="ghcr.io/your-org" value={imagePrefix} />

            <Facts columns={1} items={[{ label: 'Push credential', value: settings?.registryConfigured ? 'Sealed on this controller' : 'Not set' }]} />
            <Input autoComplete="off" disabled={pinned || !enabled} label="Registry server" onChange={(event) => setRegistryServer(event.target.value)} placeholder="ghcr.io" value={registryServer} />
            <Input autoComplete="off" disabled={pinned || !enabled} label="Registry username" onChange={(event) => setRegistryUsername(event.target.value)} value={registryUsername} />
            <Input autoComplete="off" disabled={pinned || !enabled} hint={settings?.registryConfigured ? 'Leave blank to keep the sealed credential.' : 'Sealed with the same key as provider tokens and never shown again.'} label="Registry password or token" onChange={(event) => setRegistryPassword(event.target.value)} type="password" value={registryPassword} />

            <Checkbox checked={buildEnabled} description="Needs the namespace and credential above. Each Docker host still enforces its own build permission." disabled={pinned || !enabled} onChange={(event) => setBuildEnabled(event.target.checked)}>Allow bounded image builds</Checkbox>

            <Input disabled={pinned || !enabled} hint="Comma-separated hostnames, for example git.example.com. Leave empty for github.com and gitlab.com." label="Private provider hosts" onChange={(event) => setPrivateHosts(event.target.value)} placeholder="git.example.com" value={privateHosts} />

            <Banner title="What leaves this page" tone="info">The password is sent once and sealed on the controller. It is never returned to this browser, and neither are provider tokens.</Banner>

            <Inline>
              <Button disabled={pinned || saving} loading={saving} onClick={() => void apply()} variant="accent">Apply settings</Button>
              <Button href={SOURCE_DOCS_URL} rel="noreferrer" target="_blank" variant="secondary">Setup guide</Button>
              <Button onClick={() => setOpen(false)} variant="ghost">Close</Button>
            </Inline>
          </Rows>
        )}
      </Sheet>
    </>
  )
}
