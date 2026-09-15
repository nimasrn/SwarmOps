import { useState } from 'react'
import { Banner, Button, DataTable, Panel, Segmented, Stack as Rows, Textarea, Timeline, Toolbar } from '@nim.zone/ui'
import type { TableColumn, useToast } from '@nim.zone/ui'
import { api } from '../../data/api'
import { useResource } from '../../data/hooks'
import type { CloudTicket } from '../../data/types'
import { formatDateTime } from '../../lib/format'
import { messageOf } from '../../lib/errors'
import { Screen } from '../../components/screen'
import { OrderStatus } from './status'

type Toast = ReturnType<typeof useToast>

/** Customer tickets, oldest unanswered first in the conversation you open. */
export function SupportPage({ toast }: { toast: Toast }) {
  const [status, setStatus] = useState('open')
  const tickets = useResource(() => api.commerceTickets(status), [status])
  const all = useResource(() => api.commerceTickets(), [])
  const [openID, setOpenID] = useState(0)
  const rows = tickets.data ?? []
  const count = (value: string) => (all.data ?? []).filter((ticket) => ticket.status === value).length

  const columns: TableColumn<CloudTicket>[] = [
    { header: 'Subject', key: 'subject', render: (row) => row.subject },
    { header: 'Customer', key: 'customer', render: (row) => row.customerEmail ?? `user ${row.userId}` },
    { header: 'Priority', key: 'priority', render: (row) => row.priority },
    { header: 'Last activity', key: 'updated', render: (row) => formatDateTime(row.updatedAt) },
    { header: 'Status', key: 'status', render: (row) => <OrderStatus status={row.status} /> },
    { header: '', key: 'open', render: (row) => <Button onClick={() => setOpenID(row.id)} size="sm" variant="secondary">Open</Button> },
  ]

  return (
    <Screen
      insights={[
        { hint: 'Waiting for an answer from you', icon: 'chat', label: 'Open', tone: count('open') ? 'warning' : 'success', value: String(count('open')) },
        { hint: 'Answered, waiting for the customer', icon: 'reply', label: 'Answered', value: String(count('answered')) },
        { hint: 'Resolved conversations', icon: 'check', label: 'Closed', value: String(count('closed')) },
      ]}
      page="support"
    >
      <Panel title="Tickets">
        <Toolbar>
          <Segmented label="Ticket status" onChange={(value) => { setStatus(value); setOpenID(0) }} options={['open', 'answered', 'closed'].map((value) => ({ label: value, value }))} value={status} />
        </Toolbar>
        <DataTable columns={columns} empty="No tickets in this state." error={tickets.error || undefined} loading={tickets.loading} rowKey={(row) => String(row.id)} rows={rows} />
      </Panel>
      {openID ? <Conversation id={openID} key={openID} onChanged={() => { tickets.reload(); all.reload() }} toast={toast} /> : null}
    </Screen>
  )
}

function Conversation({ id, onChanged, toast }: { id: number; onChanged: () => void; toast: Toast }) {
  const ticket = useResource(() => api.commerceTicket(id), [id])
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true)
    try {
      await action()
      toast({ message, tone: 'success' })
      setReply('')
      ticket.reload()
      onChanged()
    } catch (reason) {
      toast({ duration: 0, message: messageOf(reason), tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  const value = ticket.data
  return (
    <Panel caption={value?.customerEmail} title={value?.subject ?? 'Loading ticket'}>
      <Rows>
        {ticket.error ? <Banner tone="danger">{ticket.error}</Banner> : null}
        {value ? (
          <Timeline entries={(value.messages ?? []).map((message) => ({
            body: message.body,
            icon: message.authorRole === 'admin' ? 'shield' : 'user',
            id: String(message.id),
            time: formatDateTime(message.createdAt),
            title: message.authorName,
            tone: message.authorRole === 'admin' ? 'accent' : 'muted',
          }))} />
        ) : null}
        {value && value.status !== 'closed' ? (
          <>
            <Textarea label="Reply" onChange={(event) => setReply(event.target.value)} value={reply} />
            <Button disabled={busy || !reply.trim()} onClick={() => void run(() => api.replyCloudTicket(id, reply), 'Reply sent')}>Send reply</Button>
            <Button disabled={busy} onClick={() => void run(() => api.closeCloudTicket(id), 'Ticket closed')} variant="secondary">Close ticket</Button>
          </>
        ) : null}
      </Rows>
    </Panel>
  )
}
