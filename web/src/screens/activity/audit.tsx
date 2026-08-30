import { useState } from 'react'
import {
  ActivityFeed,
  EmptyState,
  Input,
  Panel,
  Select,
  Toolbar,
} from '@nim.zone/ui'
import type { AuditEvent } from '../../data/types'
import { relativeTime } from '../../lib/format'
import { Screen } from '../../components/screen'

/**
 * Who did what, when, and against which host.
 *
 * The feed was previously unfiltered, which made it unusable at exactly the
 * moment it matters: an operator answering "what happened to this host last
 * night" had to scroll a hundred records. Actor, outcome, and free text now
 * narrow it, and the counts above say what the filter is narrowing from.
 */
export function AuditPage({ events }: { events: AuditEvent[] }) {
  const [query, setQuery] = useState('')
  const [outcome, setOutcome] = useState('all')
  const [actor, setActor] = useState('all')

  const actors = [...new Set(events.map((event) => event.actor))].sort()
  const failures = events.filter((event) => event.outcome !== 'success')
  const filtered = events.filter((event) =>
    (!query || `${event.action} ${event.target} ${event.actor}`.toLowerCase().includes(query.toLowerCase()))
    && (outcome === 'all' || event.outcome === outcome)
    && (actor === 'all' || event.actor === actor))

  return (
    <Screen
      about="The record contains actors, targets, outcomes, and request IDs — never passwords, Compose content, build contexts, or registry credentials."
      insights={[
        { hint: 'Retained operator activity records', icon: 'shield', label: 'Recorded events', value: String(events.length) },
        { hint: failures.length ? 'Operations that did not report success' : 'Every recorded operation reported success', icon: 'alert', label: 'Non-success outcomes', tone: failures.length ? 'warning' : 'success', value: String(failures.length) },
        { hint: 'Distinct operators and services in the record', icon: 'users', label: 'Actors', value: String(actors.length) },
        { hint: 'When the newest record was written', icon: 'clock', label: 'Latest activity', value: events[0] ? relativeTime(events[0].occurredAt) : 'never' },
      ]}
      page="audit"
    >
      <Panel caption={`${filtered.length} of ${events.length} shown`} title="Audit trail">
        <Toolbar>
          <Input aria-label="Search audit events" iconStart="search" onChange={(event) => setQuery(event.target.value)} placeholder="Search action, target, or actor" value={query} />
          <Select aria-label="Filter by outcome" onChange={(event) => setOutcome(event.target.value)} options={[{ label: 'Outcome: All', value: 'all' }, ...[...new Set(events.map((event) => event.outcome))].map((value) => ({ label: value, value }))]} value={outcome} />
          <Select aria-label="Filter by actor" onChange={(event) => setActor(event.target.value)} options={[{ label: 'Actor: All', value: 'all' }, ...actors.map((value) => ({ label: value, value }))]} value={actor} />
        </Toolbar>
        <ActivityFeed
          empty={<EmptyState description="The controller has not recorded an operation matching this filter." icon="clock" title="No audit events" />}
          events={filtered.map((event) => ({
            action: `${event.action} · ${event.outcome}`,
            actor: event.actor,
            at: event.occurredAt,
            icon: event.outcome === 'success' ? 'check' as const : 'danger' as const,
            id: event.id,
            target: event.target,
            tone: event.outcome === 'success' ? 'success' as const : 'danger' as const,
          }))}
        />
      </Panel>
    </Screen>
  )
}
