import { useState } from 'react'
import {
  Banner,
  Body,
  Button,
  CodeBlock,
  Facts,
  Icon,
  List,
  ListRow,
  Panel,
  Sheet,
  Stack as Rows,
  StatusDot,
} from '@nim.zone/ui'
import type { SourceStatus } from '../../../data/types'

/**
 * The four controller settings source deployment needs, and why each one
 * exists.
 *
 * They are startup settings rather than console settings on purpose: SwarmOps
 * will not rewrite its own environment or registry credential while it is
 * running. So this screen can only READ the boundary and say exactly what to
 * add — a form that pretended to change it would be lying about what happens
 * when you press save.
 */
export function SourceSetupPanel({ status }: { status: SourceStatus }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Panel eyebrow="Setup required" marker={<Icon name="lock" size="sm" />} title="Connect source code and an image registry">
        <Rows>
          <Body size="sm">Source deployment is not ready yet. Complete the requirements below, restart the controller, then SwarmOps will validate providers, scan a repository, build a bounded image, and deploy it through the normal workload path.</Body>
          <List plain>
            <ListRow leading={<Icon name={status.enabled ? 'check-circle' : 'alert'} size="sm" tone={status.enabled ? 'success' : 'warning'} />} subtitle="Allows the controller to accept source-provider connections." title="Source deployment enabled" trailing={<StatusDot tone={status.enabled ? 'success' : 'warning'}>{status.enabled ? 'Ready' : 'Required'}</StatusDot>} />
            <ListRow leading={<Icon name={status.imagePrefixConfigured ? 'check-circle' : 'alert'} size="sm" tone={status.imagePrefixConfigured ? 'success' : 'warning'} />} subtitle="The registry namespace where immutable application images are pushed." title="Registry image prefix" trailing={<StatusDot tone={status.imagePrefixConfigured ? 'success' : 'warning'}>{status.imagePrefixConfigured ? 'Ready' : 'Required'}</StatusDot>} />
            <ListRow leading={<Icon name={status.buildEnabled ? 'check-circle' : 'alert'} size="sm" tone={status.buildEnabled ? 'success' : 'warning'} />} subtitle="Runs only the reviewed, resource-bounded source build workflow." title="Bounded builds" trailing={<StatusDot tone={status.buildEnabled ? 'success' : 'warning'}>{status.buildEnabled ? 'Ready' : 'Required'}</StatusDot>} />
            <ListRow leading={<Icon name={status.privateHostsConfigured ? 'check-circle' : 'info'} size="sm" tone={status.privateHostsConfigured ? 'success' : undefined} />} subtitle="Only needed for GitHub Enterprise, self-managed GitLab, Gitea, or Forgejo. github.com and gitlab.com need no private-host allowlist." title="Private provider hosts" trailing={<StatusDot tone={status.privateHostsConfigured ? 'success' : 'neutral'}>{status.privateHostsConfigured ? 'Configured' : 'Optional'}</StatusDot>} />
          </List>
          <Button onClick={() => setOpen(true)} variant="accent">Configure source deployment</Button>
        </Rows>
      </Panel>

      <Sheet closeLabel="Close source setup" onClose={() => setOpen(false)} open={open} title="Configure source deployment">
        <Rows>
          <Body size="sm">These are controller startup settings, so SwarmOps cannot change them from the browser while it is running. Add the reviewed values to the controller service, restart it, then return here to verify readiness.</Body>
          <Facts columns={1} items={[
            { label: 'Hosted GitHub / GitLab', value: 'No provider-host allowlist required' },
            { label: 'Private Git provider', value: 'Add only its exact HTTPS hostname' },
            { label: 'Registry', value: 'Use the namespace SwarmOps may push application images to' },
          ]} />
          <CodeBlock label="Required controller settings" wrap>{'SWARMOPS_SOURCE_ENABLED=true\nSWARMOPS_SOURCE_BUILD_ENABLED=true\nSWARMOPS_SOURCE_IMAGE_PREFIX=registry.example.com/team'}</CodeBlock>
          <CodeBlock label="Optional private provider" wrap>SWARMOPS_SOURCE_PRIVATE_HOSTS=git.example.com</CodeBlock>
          <Banner title="Credentials stay separate" tone="info">Provider tokens and registry credentials are entered only after this readiness check passes. They are never included in this configuration snippet.</Banner>
          <Button onClick={() => setOpen(false)} variant="secondary">Done</Button>
        </Rows>
      </Sheet>
    </>
  )
}
