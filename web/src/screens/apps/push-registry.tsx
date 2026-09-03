import { useEffect, useState } from 'react'
import {
  Banner,
  Body,
  Button,
  Checkbox,
  Columns,
  Facts,
  Icon,
  Inline,
  Input,
  List,
  ListRow,
  Panel,
  Segmented,
  Sheet,
  Spinner,
  Stack as Rows,
  StatusDot,
} from '@nim.zone/ui'
import type { SourceStatus } from '../../data/types'
import { SOURCE_DOCS_URL, useSourceSettings } from './source-settings'

/**
 * Where a built image goes: nowhere, one of the two registries an operator is
 * most likely to already have an account on, or somewhere else entirely.
 *
 * 'none' is the default and it is a real answer, not an unconfigured state. An
 * operator running one machine has no registry account and should not need
 * one: the image is built on the deployment host, is never pushed, and the
 * application is pinned to that host. Choosing a hosted registry fills in the
 * host and the credential server, so the only thing left to type is the
 * account the images go under.
 */
type RegistryProvider = 'custom' | 'dockerhub' | 'ghcr' | 'none'

const REGISTRIES: Record<Exclude<RegistryProvider, 'custom' | 'none'>, { host: string; namespaceHint: string; namespaceLabel: string; tokenHint: string; usernameLabel: string }> = {
  dockerhub: {
    host: 'docker.io',
    namespaceHint: 'Your Docker Hub account or organisation. Images are pushed as docker.io/<name>/<app>.',
    namespaceLabel: 'Docker Hub account',
    tokenHint: 'A Docker Hub access token with read and write access.',
    usernameLabel: 'Docker Hub username',
  },
  ghcr: {
    host: 'ghcr.io',
    namespaceHint: 'Your GitHub user or organisation. Images are pushed as ghcr.io/<name>/<app>.',
    namespaceLabel: 'GitHub user or organisation',
    tokenHint: 'A GitHub personal access token with the write:packages scope.',
    usernameLabel: 'GitHub username',
  },
}

function providerForPrefix(prefix: string): RegistryProvider {
  if (prefix.startsWith('ghcr.io/')) return 'ghcr'
  if (prefix.startsWith('docker.io/')) return 'dockerhub'
  return prefix === '' ? 'none' : 'custom'
}

/**
 * Where images this controller builds are pushed.
 *
 * This panel used to be a read-only summary that told you to go and set the
 * values in the source-deployment sheet, which put the push registry inside the
 * screen for connecting GitHub. They are different boundaries: one is where
 * source is read from, this one is where an artefact goes. It is editable here,
 * beside the builds that produce the images it holds, and the source screen no
 * longer mentions a registry except to say where it lives.
 *
 * The credential is write-only. It is sealed on the controller with the same
 * key as provider tokens and never returned to this browser.
 */
export function PushRegistryPanel({ onApplied, status }: { onApplied?: () => void; status: SourceStatus }) {
  const [open, setOpen] = useState(false)
  const { error, load, loading, save, saved, saving, settings } = useSourceSettings()

  const [buildEnabled, setBuildEnabled] = useState(false)
  const [provider, setProvider] = useState<RegistryProvider>('none')
  const [namespace, setNamespace] = useState('')
  const [imagePrefix, setImagePrefix] = useState('')
  const [registryServer, setRegistryServer] = useState('')
  const [registryUsername, setRegistryUsername] = useState('')
  const [registryPassword, setRegistryPassword] = useState('')

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!settings) return
    setBuildEnabled(settings.buildEnabled)
    const detected = providerForPrefix(settings.imagePrefix)
    setProvider(detected)
    setNamespace(detected === 'custom' ? '' : settings.imagePrefix.split('/').slice(1).join('/'))
    setImagePrefix(settings.imagePrefix)
    setRegistryServer(settings.registryServer)
    setRegistryUsername(settings.registryUsername)
    setRegistryPassword('')
  }, [settings])

  // The chosen registry decides the prefix and the credential server, so a
  // hosted choice cannot end up with an image namespace on one registry and a
  // password for another.
  const chosen = provider === 'custom' || provider === 'none' ? null : REGISTRIES[provider]
  const account = namespace.trim().replace(/^\/+|\/+$/g, '').toLowerCase()
  const effectivePrefix = provider === 'none' ? '' : chosen ? (account === '' ? '' : `${chosen.host}/${account}`) : imagePrefix.trim()
  const effectiveServer = provider === 'none' ? '' : chosen ? chosen.host : registryServer.trim()

  async function apply() {
    const applied = await save({
      buildEnabled,
      imagePrefix: effectivePrefix,
      registryPassword: provider === 'none' ? undefined : registryPassword || undefined,
      registryServer: effectiveServer,
      registryUsername: provider === 'none' ? '' : registryUsername.trim(),
    })
    if (applied) onApplied?.()
  }

  const pinned = settings ? !settings.settingsEditable : false
  const ready = status.buildEnabled
  return (
    <>
      <Panel
        actions={<Button disabled={pinned} iconStart="settings" onClick={() => setOpen(true)} size="sm" variant="accent">Configure registry</Button>}
        description={ready ? (status.imagePrefixConfigured ? 'This controller may build application images and push them to the configured registry.' : 'This controller builds application images on the deployment host and keeps them there.') : 'Bounded image builds are off, so nothing can be built yet.'}
        title="Push registry"
      >
        <List plain>
          <ListRow leading={<Icon name="check-circle" size="sm" tone="success" />} subtitle={status.imagePrefixConfigured ? 'The exact namespace SwarmOps may use for generated application images.' : 'Without one, images are built on the deployment host and the application is pinned to that host.'} title="Registry namespace" trailing={<StatusDot tone={status.imagePrefixConfigured ? 'success' : 'neutral'}>{status.imagePrefixConfigured ? 'Configured' : 'Not used'}</StatusDot>} />
          <ListRow leading={<Icon name="check-circle" size="sm" tone="success" />} subtitle="Accepted once and sealed on the controller; it is never returned to this browser." title="Push credential" trailing={<StatusDot tone={settings?.registryConfigured ? 'success' : 'neutral'}>{settings?.registryConfigured ? 'Sealed' : 'Not needed'}</StatusDot>} />
          <ListRow leading={<Icon name={status.buildEnabled ? 'check-circle' : 'alert'} size="sm" tone={status.buildEnabled ? 'success' : 'warning'} />} subtitle="Only resource-bounded builds with allow-listed immutable tags can push." title="Bounded image builds" trailing={<StatusDot tone={status.buildEnabled ? 'success' : 'warning'}>{status.buildEnabled ? 'Enabled' : 'Required'}</StatusDot>} />
        </List>
      </Panel>
      <Columns>
        <Panel title="What belongs here"><Facts columns={1} items={[{ label: 'Image namespace', value: 'Registry host and namespace allowed for application images' }, { label: 'Push credential', value: 'Sealed on the controller, write-only from the console' }, { label: 'Build policy', value: 'CPU, memory, context size, and tag allow-list' }]} /></Panel>
        <Panel title="What does not belong here"><Facts columns={1} items={[{ label: 'Provider tokens', value: 'Apps → Deploy' }, { label: 'Pull-through mirror', value: 'Control → Registry mirror' }, { label: 'Running images', value: 'Machines → Storage & networks' }]} /></Panel>
      </Columns>
      <Sheet closeLabel="Close registry setup" onClose={() => setOpen(false)} open={open} title="Configure the push registry">
        {loading && !settings ? <Spinner label="Reading registry settings" /> : (
          <Rows>
            {error ? <Banner title="Settings were not applied" tone="danger">{error}</Banner> : null}
            {saved && !error ? <Banner title="Applied" tone="success">The controller is using these settings now. No restart is needed.</Banner> : null}
            {pinned ? <Banner title="Pinned by this controller" tone="warning">This controller was started with its registry settings fixed, so they cannot be changed from the console. Ask whoever runs the host, or follow the setup guide.</Banner> : null}
            <Body size="sm">Where images SwarmOps builds are pushed. A registry is optional: without one, an image is built on the host the deployment targets and read from that host's own image store. This is not the mirror your machines pull public images through, and it is not related to which provider source is read from.</Body>

            <Segmented label="Registry" onChange={(value) => setProvider(value)} options={[{ disabled: pinned, label: 'No registry', value: 'none' }, { disabled: pinned, label: 'GitHub Container Registry', value: 'ghcr' }, { disabled: pinned, label: 'Docker Hub', value: 'dockerhub' }, { disabled: pinned, label: 'Other registry', value: 'custom' }]} value={provider} />

            {provider === 'none' ? (
              <Banner title="Images stay on the deployment host" tone="info">Nothing to configure. Each image is built on the host the deployment targets, is never pushed, and the application is pinned to that host so Swarm cannot schedule it where the image does not exist. Choose a registry when you want the same image to run on any node.</Banner>
            ) : chosen ? (
              <Input disabled={pinned} hint={chosen.namespaceHint} label={chosen.namespaceLabel} onChange={(event) => setNamespace(event.target.value)} placeholder={provider === 'ghcr' ? 'your-org' : 'your-account'} value={namespace} />
            ) : (
              <>
                <Input disabled={pinned} hint="Registry host and namespace SwarmOps may push generated images to, such as ghcr.io/your-org." label="Registry namespace" onChange={(event) => setImagePrefix(event.target.value)} placeholder="ghcr.io/your-org" value={imagePrefix} />
                <Input autoComplete="off" disabled={pinned} label="Registry server" onChange={(event) => setRegistryServer(event.target.value)} placeholder="ghcr.io" value={registryServer} />
              </>
            )}
            {provider === 'none' ? null : (
              <>
                <Input autoComplete="off" disabled={pinned} label={chosen ? chosen.usernameLabel : 'Registry username'} onChange={(event) => setRegistryUsername(event.target.value)} value={registryUsername} />
                <Input autoComplete="off" disabled={pinned} hint={settings?.registryConfigured ? 'Leave blank to keep the sealed credential.' : chosen ? chosen.tokenHint : 'Sealed with the same key as provider tokens and never shown again.'} label="Registry password or token" onChange={(event) => setRegistryPassword(event.target.value)} type="password" value={registryPassword} />
              </>
            )}

            <Body size="sm">{effectivePrefix ? <>Images will be pushed as <code>{effectivePrefix}/&lt;app&gt;:&lt;commit&gt;</code>.</> : provider === 'none' ? <>Images will be built as <code>swarmops-local/&lt;app&gt;:&lt;commit&gt;</code> on the deployment host.</> : <>Enter the account images are pushed under. Until then they are built as <code>swarmops-local/&lt;app&gt;:&lt;commit&gt;</code> on the deployment host.</>}</Body>

            <Checkbox checked={buildEnabled} description="This is the only setting a build needs. Each Docker host still enforces its own build permission." disabled={pinned} onChange={(event) => setBuildEnabled(event.target.checked)}>Allow bounded image builds</Checkbox>

            <Banner title="Per-host builds stay a host decision" tone="info">Turning on bounded builds lets the controller submit them. Each Docker host still enforces its own build permission and image allow-list. The password is sent once and never returned to this browser.</Banner>

            <Inline>
              <Button disabled={pinned || saving || !settings} loading={saving} onClick={() => void apply()} variant="accent">Apply settings</Button>
              <Button href={SOURCE_DOCS_URL} rel="noreferrer" target="_blank" variant="secondary">Setup guide</Button>
              <Button onClick={() => setOpen(false)} variant="ghost">Done</Button>
            </Inline>
          </Rows>
        )}
      </Sheet>
    </>
  )
}
