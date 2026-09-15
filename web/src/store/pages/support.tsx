import { useState } from 'react'
import type { FormEvent } from 'react'
import { Banner, Button, Card, DataTable, EmptyState, Input, SectionHeader, Select, Stack as Rows, Textarea, Timeline } from '@nim.zone/ui'
import type { TableColumn } from '@nim.zone/ui'
import type { CloudTicket } from '../../data/types'
import { useStore } from '../context'
import { StatusBadge, errorMessage, useStoreData } from './shared'

export function SupportPage() {
  const { api, date, t } = useStore()
  const tickets = useStoreData(() => api.tickets())
  const [openID, setOpenID] = useState(0)

  if (openID) return <TicketView id={openID} onBack={() => { setOpenID(0); tickets.reload() }} />

  const columns: TableColumn<CloudTicket>[] = [
    { header: t('column.subject'), key: 'subject', render: (row) => row.subject },
    { header: t('column.status'), key: 'status', render: (row) => <StatusBadge status={row.status} /> },
    { header: t('column.updated'), key: 'updated', render: (row) => date(row.updatedAt) },
    { header: '', key: 'open', render: (row) => <Button onClick={() => setOpenID(row.id)} size="sm" variant="ghost">{t('action.view')}</Button> },
  ]

  return (
    <Rows gap="loose">
      <SectionHeader description={t('support.subtitle')} title={t('support.title')} />
      <NewTicket onOpened={(ticket) => setOpenID(ticket.id)} />
      <DataTable
        columns={columns}
        empty={<EmptyState icon="chat" title={t('support.empty')} />}
        error={tickets.error || undefined}
        loading={tickets.loading}
        rowKey={(row) => String(row.id)}
        rows={tickets.data ?? []}
      />
    </Rows>
  )
}

function NewTicket({ onOpened }: { onOpened: (ticket: CloudTicket) => void }) {
  const { api, t } = useStore()
  const projects = useStoreData(() => api.projects())
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [priority, setPriority] = useState('normal')
  const [projectID, setProjectID] = useState('0')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      onOpened(await api.openTicket(subject, body, priority, Number(projectID)))
    } catch (reason) {
      setError(errorMessage(reason, t('common.error')))
    } finally {
      setPending(false)
    }
  }

  return (
    <Card header={t('support.new')}>
      <form onSubmit={(event) => void submit(event)}>
        <Rows gap="md">
          {error ? <Banner tone="danger">{error}</Banner> : null}
          <Input label={t('field.subject')} maxLength={160} onChange={(event) => setSubject(event.target.value)} required value={subject} />
          <Select
            label={t('field.project')}
            onChange={(event) => setProjectID(event.target.value)}
            options={[{ label: t('field.noProject'), value: '0' }, ...(projects.data ?? []).map((project) => ({ label: project.appName, value: String(project.id) }))]}
            value={projectID}
          />
          <Select
            label={t('field.priority')}
            onChange={(event) => setPriority(event.target.value)}
            options={[{ label: t('priority.low'), value: 'low' }, { label: t('priority.normal'), value: 'normal' }, { label: t('priority.high'), value: 'high' }]}
            value={priority}
          />
          <Textarea label={t('field.message')} maxLength={5000} onChange={(event) => setBody(event.target.value)} required rows={4} value={body} />
          <Button disabled={subject.length < 3 || !body} loading={pending} type="submit">{t('action.openTicket')}</Button>
        </Rows>
      </form>
    </Card>
  )
}

function TicketView({ id, onBack }: { id: number; onBack: () => void }) {
  const { api, date, t } = useStore()
  const ticket = useStoreData(() => api.ticket(id), [id])
  const [reply, setReply] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const run = async (action: () => Promise<unknown>) => {
    setPending(true)
    setError('')
    try {
      await action()
      setReply('')
      ticket.reload()
    } catch (reason) {
      setError(errorMessage(reason, t('common.error')))
    } finally {
      setPending(false)
    }
  }

  const value = ticket.data
  return (
    <Rows gap="loose">
      <SectionHeader action={<Button onClick={onBack} variant="ghost">{t('action.back')}</Button>} title={value?.subject ?? t('common.loading')} />
      {value ? <StatusBadge status={value.status} /> : null}
      {error || ticket.error ? <Banner tone="danger">{error || ticket.error}</Banner> : null}
      {value ? (
        <Timeline
          entries={(value.messages ?? []).map((message) => ({
            body: message.body,
            icon: message.authorRole === 'admin' ? 'shield' : 'user',
            id: String(message.id),
            time: date(message.createdAt),
            title: message.authorName,
            tone: message.authorRole === 'admin' ? 'accent' : 'muted',
          }))}
        />
      ) : null}
      {value && value.status !== 'closed' ? (
        <Card>
          <Rows gap="md">
            <Textarea label={t('field.message')} maxLength={5000} onChange={(event) => setReply(event.target.value)} rows={3} value={reply} />
            <Button disabled={!reply} loading={pending} onClick={() => void run(() => api.replyTicket(id, reply))}>{t('action.reply')}</Button>
            <Button disabled={pending} onClick={() => void run(() => api.closeTicket(id))} variant="secondary">{t('action.closeTicket')}</Button>
          </Rows>
        </Card>
      ) : value ? <Banner tone="neutral">{t('support.closed')}</Banner> : null}
    </Rows>
  )
}
