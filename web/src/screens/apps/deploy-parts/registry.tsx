import { useState } from 'react'
import {
  Banner,
  Body,
  Button,
  Columns,
  Facts,
  Icon,
  Inline,
  List,
  ListRow,
  Panel,
  Sheet,
  Stack as Rows,
  StatusDot,
} from '@nim.zone/ui'
import type { SourceStatus } from '../../../data/types'
import { SOURCE_DOCS_URL } from './setup'

export function RegistryBoundaryPanel({ status }: { status: SourceStatus }) {
  const [open, setOpen] = useState(false)
  const ready = status.imagePrefixConfigured && status.buildEnabled
  return (
    <>
      <Panel
        actions={<Button iconStart="settings" onClick={() => setOpen(true)} size="sm" variant="accent">Configure registry</Button>}
        description={ready ? 'This controller may push generated application images.' : 'Setup is required before anything can be pushed.'}
        title="Current controller boundary"
      >
        <List plain>
          <ListRow leading={<Icon name={status.imagePrefixConfigured ? 'check-circle' : 'alert'} size="sm" tone={status.imagePrefixConfigured ? 'success' : 'warning'} />} subtitle="The exact namespace SwarmOps may use for generated application images." title="Registry image prefix" trailing={<StatusDot tone={status.imagePrefixConfigured ? 'success' : 'warning'}>{status.imagePrefixConfigured ? 'Configured' : 'Required'}</StatusDot>} />
          <ListRow leading={<Icon name={status.buildEnabled ? 'check-circle' : 'alert'} size="sm" tone={status.buildEnabled ? 'success' : 'warning'} />} subtitle="Only resource-bounded builds with allow-listed immutable tags can push." title="Bounded image builds" trailing={<StatusDot tone={status.buildEnabled ? 'success' : 'warning'}>{status.buildEnabled ? 'Enabled' : 'Required'}</StatusDot>} />
          <ListRow leading={<Icon name="shield" size="sm" />} subtitle="Docker authentication is mounted from a protected controller file and is never returned to this browser." title="Registry credential" trailing={<StatusDot tone="neutral">Host-managed secret</StatusDot>} />
        </List>
      </Panel>
      <Columns>
        <Panel title="What belongs here"><Facts columns={1} items={[{ label: 'Image prefix', value: 'Registry host and namespace allowed for application images' }, { label: 'Push credential', value: 'Protected Docker config read only by the controller' }, { label: 'Build policy', value: 'CPU, memory, context size, and tag allow-list' }]} /></Panel>
        <Panel title="What does not belong here"><Facts columns={1} items={[{ label: 'Source tokens', value: 'Apps → Deploy' }, { label: 'Running images', value: 'Machines → Storage & networks' }, { label: 'Node pull access', value: 'Configured on each Docker host through reviewed deployment credentials' }]} /></Panel>
      </Columns>
      <Sheet closeLabel="Close registry setup" onClose={() => setOpen(false)} open={open} title="Configure the container registry">
        <Rows>
          <Body size="sm">The registry namespace and its push credential are set in the source deployment form, sealed on the controller with the same key as provider tokens, and applied without a restart. Nothing about the credential is returned to this browser.</Body>
          <Facts columns={1} items={[{ label: 'Image namespace', value: 'One reviewed registry host and namespace' }, { label: 'Push credential', value: 'Sealed on the controller, write-only from the console' }, { label: 'Build policy', value: 'CPU, memory, context size, and tag allow-list' }]} />
          <Banner title="Per-host builds stay a host decision" tone="info">Turning on bounded builds lets the controller submit them. Each Docker host still enforces its own build permission and image allow-list.</Banner>
          <Inline><Button href="#deploy" variant="accent">Open source deployment setup</Button><Button href={SOURCE_DOCS_URL} rel="noreferrer" target="_blank" variant="secondary">Setup guide</Button><Button onClick={() => setOpen(false)} variant="ghost">Done</Button></Inline>
        </Rows>
      </Sheet>
    </>
  )
}

/* The standing summary of the deployment this page is assembling. It is the
   only place the deploy command is issued from: the panels beside it collect
   decisions, and this rail is where they are read back and committed. */