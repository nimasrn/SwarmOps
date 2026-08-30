import { useState } from 'react'
import {
  Body,
  Button,
  Columns,
  Facts,
  Input,
  Label,
  Panel,
  Select,
  Stack as Rows,
  useToast,
} from '@nim.zone/ui'
import { api } from '../../data/api'
import type { SwarmSettings } from '../../data/types'
import { formatDateTime, shortID } from '../../lib/format'
import { messageOf } from '../../lib/errors'
import { useResource } from '../../data/hooks'
import { ConfirmPhrase } from '../../components/confirm-phrase'

type Toast = ReturnType<typeof useToast>

/**
 * The Swarm object itself: how much task history the managers keep, and the
 * join tokens that let a machine become part of this cluster.
 *
 * It lives beside Swarm placement rather than on the health screen it used to
 * share with charts, because both settings here are cluster-shaped: one changes
 * what the Tasks screens can still show you, and the other invalidates a
 * credential. Neither is a reading.
 */
export function SwarmSettingsPanel({ toast }: { toast: Toast }) {
  const { data, error } = useResource(() => api.swarm(), [])
  if (error) return <Panel title="Swarm settings"><Body size="sm" tone="muted">{error}</Body></Panel>
  if (!data) return <Panel title="Swarm settings"><Body size="sm" tone="muted">Reading the Swarm object…</Body></Panel>
  return <Panel description="Two cluster-wide settings. Everything else about Swarm is derived from the nodes above." title="Swarm settings"><SwarmControls settings={data} toast={toast} /></Panel>
}
function SwarmControls({ settings, toast }: { settings: SwarmSettings; toast: Toast }) {
  const [limit, setLimit] = useState(String(settings.Spec.Orchestration?.TaskHistoryRetentionLimit ?? 5))
  const [role, setRole] = useState<'manager' | 'worker'>('worker')
  const [pending, setPending] = useState('')

  const save = async () => {
    const value = Number(limit)
    if (!Number.isInteger(value) || value < 1 || value > 1000) {
      toast({ message: 'Task history limit must be a whole number from 1 to 1000.', tone: 'danger', duration: 0 })
      return
    }
    setPending('limit')
    try {
      const command = await api.updateSwarm(value)
      toast({ message: `Swarm update queued (${shortID(command.id)})`, tone: 'success' })
    } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending('') }
  }

  return (
    <Rows>
      <Facts items={[
        { label: 'Cluster ID', mono: true, value: settings.ID },
        { label: 'Created', value: formatDateTime(settings.CreatedAt) },
        { label: 'Autolock managers', value: settings.Spec.EncryptionConfig?.AutoLockManagers ? 'Enabled' : 'Disabled' },
        { label: 'Raft snapshot interval', value: String(settings.Spec.Raft?.SnapshotInterval ?? 'Not set') },
      ]} />
      <Columns>
        <Input
          hint="How many historical tasks Swarm keeps per slot."
          label="Task history limit"
          max="1000"
          min="1"
          onChange={(event) => setLimit(event.target.value)}
          step="1"
          type="number"
          value={limit}
        />
        <Rows gap="tight">
          <Body size="sm">A shorter history frees manager memory; a longer one keeps more failure evidence on the Tasks screens.</Body>
          <Button loading={pending === 'limit'} onClick={() => void save()} variant="secondary">Update swarm</Button>
        </Rows>
      </Columns>
      <Rows gap="tight">
        <Label as="p">Join token</Label>
        <Body size="sm">
          Rotating invalidates the current token so a leaked one can no longer enrol a node. SwarmOps never returns the
          new token: enrolment stays an installer workflow on the machine itself.
        </Body>
        <Columns>
          <Select
            label="Token to rotate"
            onChange={(event) => setRole(event.target.value as 'manager' | 'worker')}
            options={[{ label: 'Worker', value: 'worker' }, { label: 'Manager', value: 'manager' }]}
            value={role}
          />
          <ConfirmPhrase
            busy={pending === 'token'}
            consequence="The current join token stops working. A machine that has not joined yet will need the new one, which SwarmOps never returns to this console — enrolment stays an installer workflow on the machine itself."
            phrase={`ROTATE_${role.toUpperCase()}_JOIN_TOKEN`}
            action="Rotate token"
            variant="secondary"
            onConfirm={async (confirmation) => {
              setPending('token')
              try {
                const command = await api.rotateJoinToken(role, confirmation)
                toast({ message: `Join-token rotation queued (${shortID(command.id)})`, tone: 'success' })
              } catch (reason) { toast({ message: messageOf(reason), tone: 'danger', duration: 0 }) } finally { setPending('') }
            }}
          />
        </Columns>
      </Rows>
    </Rows>
  )
}
