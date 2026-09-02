import { useEffect, useState } from 'react'
import {
  Banner,
  Body,
  Button,
  Checkbox,
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
import type { SourceStatus } from '../../../data/types'
import { SOURCE_DOCS_URL, useSourceSettings } from '../source-settings'

/**
 * The provider boundary, and the form that turns it on.
 *
 * Two things used to sit in this sheet that are not the source boundary at all:
 * the registry namespace a built image is pushed to, and its sealed push
 * credential. They read as steps in connecting GitHub, which is exactly what
 * they are not — one is where source is READ FROM, the other is where an image
 * GOES. The registry moved to Apps → Images & registries, beside the builds
 * that produce the images it holds, and the fleet's pull-through mirror is its
 * own destination under Control.
 *
 * What is left is the boundary itself: the switch that lets this controller
 * talk to a provider at all, and the allow-list a self-managed provider needs.
 * Both are sealed console settings applied without a restart. Provider tokens
 * are never entered here — they belong to a connection, one per provider.
 */
export function SourceSetupPanel({ onApplied, status }: { onApplied?: () => void; status: SourceStatus }) {
  const [open, setOpen] = useState(false)
  const { error, load, loading, save, saved, saving, settings } = useSourceSettings()

  const [enabled, setEnabled] = useState(false)
  const [privateHosts, setPrivateHosts] = useState('')

  useEffect(() => { if (open) void load() }, [load, open])
  useEffect(() => {
    if (!settings) return
    setEnabled(settings.enabled)
    setPrivateHosts((settings.privateHosts ?? []).join(', '))
  }, [settings])

  async function apply() {
    const applied = await save({
      enabled,
      privateHosts: privateHosts.split(',').map((host) => host.trim()).filter(Boolean),
    })
    if (applied) onApplied?.()
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
          <Body size="sm">Source deployment is off, so this controller refuses every provider call. Turn it on below and SwarmOps will connect GitHub, GitLab, Gitea, or Forgejo with a read-only token, list your projects, scan the one you choose for its Dockerfile, Compose file, and databases, map a route, then deploy it. Nothing here needs a shell on the controller or a restart.</Body>
          <List plain>
            <ListRow leading={<Icon name={status.enabled ? 'check-circle' : 'alert'} size="sm" tone={status.enabled ? 'success' : 'warning'} />} subtitle="Lets the controller accept source-provider connections." title="Source deployment" trailing={<StatusDot tone={status.enabled ? 'success' : 'warning'}>{status.enabled ? 'On' : 'Off'}</StatusDot>} />
            <ListRow leading={<Icon name={status.privateHostsConfigured ? 'check-circle' : 'info'} size="sm" tone={status.privateHostsConfigured ? 'success' : undefined} />} subtitle="Only for GitHub Enterprise, self-managed GitLab, Gitea, or Forgejo. github.com and gitlab.com need nothing here." title="Private provider hosts" trailing={<StatusDot tone={status.privateHostsConfigured ? 'success' : 'neutral'}>{status.privateHostsConfigured ? 'Set' : 'Optional'}</StatusDot>} />
          </List>
          <Banner title="The registry is a separate setting" tone="info">Where a built image is pushed — the namespace, its credential, and bounded builds — is set under Apps → Images &amp; registries. Connecting a provider and scanning a repository do not need it.</Banner>
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

            <Input disabled={pinned || !enabled} hint="Comma-separated hostnames, for example git.example.com. Leave empty for github.com and gitlab.com." label="Private provider hosts" onChange={(event) => setPrivateHosts(event.target.value)} placeholder="git.example.com" value={privateHosts} />

            <Banner title="Tokens come next, not here" tone="info">A provider token belongs to one connection and is entered on the Provider step after this boundary is on. It is verified, sealed on the controller, and never returned to this browser.</Banner>

            <Inline>
              <Button disabled={pinned || saving || !settings} loading={saving} onClick={() => void apply()} variant="accent">Apply settings</Button>
              <Button href={SOURCE_DOCS_URL} rel="noreferrer" target="_blank" variant="secondary">Setup guide</Button>
              <Button onClick={() => setOpen(false)} variant="ghost">Close</Button>
            </Inline>
          </Rows>
        )}
      </Sheet>
    </>
  )
}
