import { useState } from 'react'
import {
  Banner,
  Body,
  Button,
  DataTable,
  EmptyState,
  Inline,
  Input,
  Panel,
  Select,
  Sheet,
  Stack as Rows,
  StatusDot,
  Textarea,
  useToast,
} from '@nim.zone/ui'
import type { TableColumn } from '@nim.zone/ui'
import { api } from '../../data/api'
import type { ComposePlan, Node, Stack } from '../../data/types'
import { formatDateTime, shortDigest, shortID } from '../../lib/format'
import { messageOf } from '../../lib/errors'
import { StatusBadge } from '../../components/badges'
import { ConfirmPhrase } from '../../components/confirm-phrase'

type Toast = ReturnType<typeof useToast>

/**
 * Namespaced groups of services, and the one way to add another.
 *
 * Writing Compose is the ADVANCED path — the supported route to a running
 * application is Apps → Deploy, which renders the Compose, the route, the probe
 * and the wiring for you. So the editor lives behind a button rather than
 * beside the list: presented as equals, an operator reasonably concludes that
 * hand-written Compose is what the product expects of them.
 *
 * Behind a button is right; behind NO button, which is what this screen
 * actually shipped, is a two-hundred-line editor that nothing could open. The
 * button is quiet and it exists.
 */
export function StacksTab({ nodes, stacks, onDeployFromSource, toast }: {
  nodes: Node[]
  onDeployFromSource: () => void
  stacks: Stack[]
  toast: Toast
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [compose, setCompose] = useState('')
  const [targetNodeID, setTargetNodeID] = useState('')
  const [plan, setPlan] = useState<ComposePlan | null>(null)
  const [pending, setPending] = useState<'deploy' | 'validate' | null>(null)
  const [removing, setRemoving] = useState('')
  const [error, setError] = useState('')

  const importCompose = async (file: File | undefined) => {
    if (!file) return
    if (file.size > 512 * 1024) {
      setError('Compose files must be 512 KiB or smaller.')
      return
    }
    try {
      setCompose(await file.text())
      setPlan(null)
      setError('')
      if (!name) setName(file.name.replace(/\.(ya?ml)$/i, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, ''))
    } catch {
      setError('The selected Compose file could not be read locally.')
    }
  }

  const validate = async () => {
    setPending('validate')
    setError('')
    try {
      setPlan(await api.validateStack(name, compose, targetNodeID))
    } catch (reason) {
      setPlan(null)
      setError(messageOf(reason))
    } finally {
      setPending(null)
    }
  }

  const deploy = async () => {
    setPending('deploy')
    setError('')
    try {
      const command = await api.deployStack(name, compose, targetNodeID)
      toast({ message: `Deployment queued for ${name} (${shortID(command.id)})`, tone: 'success' })
      setOpen(false)
    } catch (reason) {
      setError(messageOf(reason))
    } finally {
      setPending(null)
    }
  }


  const remove = async (stack: Stack, confirmation: string) => {
    setRemoving(stack.name)
    try {
      const command = await api.removeStack(stack.name, confirmation)
      toast({ message: `Removal of ${stack.name} queued (${shortID(command.id)})`, tone: 'success' })
    } catch (reason) {
      toast({ duration: 0, message: messageOf(reason), tone: 'danger' })
    } finally {
      setRemoving('')
    }
  }

  const columns: TableColumn<Stack>[] = [
    { header: 'Stack', key: 'name', render: (stack) => <strong>{stack.name}</strong> },
    { header: 'Services', key: 'services', numeric: true, render: (stack) => stack.serviceCount },
    { header: 'Running tasks', key: 'tasks', numeric: true, render: (stack) => stack.runningTasks },
    { header: 'Health', key: 'health', render: (stack) => <StatusBadge health={stack.health} /> },
    { header: 'Last change', key: 'updated', render: (stack) => formatDateTime(stack.updatedAt) },
    {
      header: '',
      key: 'actions',
      render: (stack) => (
        <ConfirmPhrase
          action="Remove"
          busy={removing === stack.name}
          compact
          onConfirm={(confirmation) => remove(stack, confirmation)}
          phrase={`REMOVE_STACK_${stack.name.toUpperCase()}`}
        />
      ),
    },
  ]

  return (
    <>
      <Panel
        actions={
          <Inline>
            <Button onClick={onDeployFromSource} size="sm" variant="accent">Deploy from source</Button>
            <Button onClick={() => setOpen(true)} size="sm" variant="ghost">Write Compose</Button>
          </Inline>
        }
        caption={`${stacks.length} discovered`}
        description="Removing a stack removes every service in it. The volumes those services mounted, and the data in them, are left behind."
        flush
        title="Managed stacks"
      >
        <DataTable
          caption="Discovered Docker stacks"
          columns={columns}
          empty={<EmptyState actions={<Button onClick={onDeployFromSource} variant="accent">Deploy from source</Button>} description="No Docker stack labels were found in the current service inventory." icon="layers" title="No stacks" />}
          rowKey={(stack) => stack.name}
          rows={stacks}
        />
      </Panel>

      <Sheet closeLabel="Close the Compose editor" onClose={() => setOpen(false)} open={open} title="Deploy a reviewed Compose stack">
        <Rows>
          <Banner title="What admission will refuse" tone="info">
            Image-only Compose v3.9. Every service needs reservations and limits; host binds, direct ports, global modes, build directives, inline secrets, and unscoped routes are refused before anything runs.
          </Banner>
          <Input hint="Must be the reviewed namespace plus workload name, for example production-api." label="Stack name" onChange={(event) => setName(event.target.value)} value={name} />
          <Select label="Pin every service to one node" onChange={(event) => setTargetNodeID(event.target.value)} options={nodes.map((node) => ({ label: `${node.hostname} · ${node.state} · ${node.availability}`, value: node.id }))} placeholder="Let Swarm schedule this stack" value={targetNodeID} />
          <Input accept=".yaml,.yml,text/yaml,text/x-yaml" hint="Read locally only; the selected file is sent only when you validate or deploy it." label="Import Docker Compose file" onChange={(event) => void importCompose(event.target.files?.[0])} type="file" />
          <Textarea hint="External resources must be named production-api-* (or production-api_*); HTTPS router names must share that prefix and use the declared domain. Approved Compose is held in protected command storage only until its deployment succeeds." label="Compose v3.9" onChange={(event) => setCompose(event.target.value)} rows={16} value={compose} />
          {error ? <Banner tone="danger">{error}</Banner> : null}
          {plan ? (
            <Banner title="Compose policy accepted" tone="success">
              <strong>{plan.services.join(', ')}</strong> · {shortDigest(plan.digest)}
              {plan.targetNodeId ? ` · pinned to ${shortID(plan.targetNodeId)}` : ''}
              {plan.warnings.map((warning) => <StatusDot key={warning} tone="warning">{warning}</StatusDot>)}
            </Banner>
          ) : null}
          <Body size="sm" tone="muted">Validation is a policy check, not a dry run: it proves the file would be accepted, not that the cluster has room for it.</Body>
          <Inline>
            <Button disabled={!compose || pending !== null} loading={pending === 'validate'} onClick={() => void validate()} variant="secondary">Validate Compose</Button>
            <Button disabled={!name || !compose || pending !== null} loading={pending === 'deploy'} onClick={() => void deploy()} variant="accent">Deploy stack</Button>
          </Inline>
        </Rows>
      </Sheet>
    </>
  )
}
