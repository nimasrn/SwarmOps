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
import { Screen } from '../../../components/screen'

export function RegistryBoundaryPage({ status }: { status: SourceStatus }) {
  const [open, setOpen] = useState(false)
  const ready = status.imagePrefixConfigured && status.buildEnabled
  return (
    <Screen
      about="The registry is where SwarmOps pushes immutable application images. It is separate from source-provider access and from Docker’s runtime image inventory."
      actions={<Button iconStart="settings" onClick={() => setOpen(true)} variant="accent">Configure registry</Button>}
      insights={[
        { hint: status.imagePrefixConfigured ? 'The namespace SwarmOps may push generated images to' : 'No namespace is allowed, so nothing can be pushed', icon: 'cloud', label: 'Image prefix', tone: status.imagePrefixConfigured ? 'success' : 'warning', value: status.imagePrefixConfigured ? 'Configured' : 'Required' },
        { hint: status.buildEnabled ? 'Only resource-bounded builds with immutable tags may push' : 'The controller will not run a source build', icon: 'package', label: 'Bounded builds', tone: status.buildEnabled ? 'success' : 'warning', value: status.buildEnabled ? 'Enabled' : 'Required' },
        { hint: 'Read from a protected controller file and never returned to this browser', icon: 'key', label: 'Push credential', value: 'Host-managed' },
      ]}
      page="registry"
      status={<StatusDot tone={ready ? 'success' : 'warning'}>{ready ? 'Registry boundary ready' : 'Setup required'}</StatusDot>}
    >
      <Panel title="Current controller boundary">
        <List plain>
          <ListRow leading={<Icon name={status.imagePrefixConfigured ? 'check-circle' : 'alert'} size="sm" tone={status.imagePrefixConfigured ? 'success' : 'warning'} />} subtitle="The exact namespace SwarmOps may use for generated application images." title="Registry image prefix" trailing={<StatusDot tone={status.imagePrefixConfigured ? 'success' : 'warning'}>{status.imagePrefixConfigured ? 'Configured' : 'Required'}</StatusDot>} />
          <ListRow leading={<Icon name={status.buildEnabled ? 'check-circle' : 'alert'} size="sm" tone={status.buildEnabled ? 'success' : 'warning'} />} subtitle="Only resource-bounded builds with allow-listed immutable tags can push." title="Bounded image builds" trailing={<StatusDot tone={status.buildEnabled ? 'success' : 'warning'}>{status.buildEnabled ? 'Enabled' : 'Required'}</StatusDot>} />
          <ListRow leading={<Icon name="shield" size="sm" />} subtitle="Docker authentication is mounted from a protected controller file and is never returned to this browser." title="Registry credential" trailing={<StatusDot tone="neutral">Host-managed secret</StatusDot>} />
        </List>
      </Panel>
      <Columns>
        <Panel title="What belongs here"><Facts columns={1} items={[{ label: 'Image prefix', value: 'Registry host and namespace allowed for application images' }, { label: 'Push credential', value: 'Protected Docker config read only by the controller' }, { label: 'Build policy', value: 'CPU, memory, context size, and tag allow-list' }]} /></Panel>
        <Panel title="What does not belong here"><Facts columns={1} items={[{ label: 'Source tokens', value: 'Settings → Source deployment' }, { label: 'Running images', value: 'Workloads → Images & builds' }, { label: 'Node pull access', value: 'Configured on each Docker host through reviewed deployment credentials' }]} /></Panel>
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
    </Screen>
  )
}

/* The standing summary of the deployment this page is assembling. It is the
   only place the deploy command is issued from: the panels beside it collect
   decisions, and this rail is where they are read back and committed. */