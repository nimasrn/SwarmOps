import { useState } from 'react'
import {
  Banner,
  Body,
  Button,
  CodeBlock,
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
          <Body size="sm">These are protected controller startup settings. SwarmOps cannot safely rewrite its own environment or registry credential while it is running. Configure them on the controller host, restart Core, then return here to verify the boundary.</Body>
          <Facts columns={1} items={[{ label: 'Image namespace', value: 'One reviewed registry host and namespace' }, { label: 'Allow-list', value: 'Prefixes Docker may build and push' }, { label: 'Credential file', value: 'Owner-readable Docker config.json outside the repository' }]} />
          <CodeBlock label="Required controller settings" wrap>{'SWARMOPS_BUILD_ENABLED=true\nSWARMOPS_SOURCE_IMAGE_PREFIX=ghcr.io/your-org\nSWARMOPS_IMAGE_PREFIXES=ghcr.io/your-org/\nSWARMOPS_REGISTRY_CONFIG_FILE=/etc/swarmops/registry-config.json'}</CodeBlock>
          <Banner title="No credential is pasted into this page" tone="info">The registry file remains on the controller host. The browser receives only readiness metadata—not its path contents, username, password, or token.</Banner>
          <Inline><Button href="#core" variant="secondary">Open controller settings</Button><Button onClick={() => setOpen(false)} variant="ghost">Done</Button></Inline>
        </Rows>
      </Sheet>
    </>
  )
}

/* The standing summary of the deployment this page is assembling. It is the
   only place the deploy command is issued from: the panels beside it collect
   decisions, and this rail is where they are read back and committed. */