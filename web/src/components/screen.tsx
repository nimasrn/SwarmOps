import type { ReactNode } from 'react'
import { Body, DetailHeader, Metric, MetricGrid, Page, Stack as Rows } from '@nim.zone/ui'
import type { IconName, PageWidth, StatusTone } from '@nim.zone/ui'
import { pageEntry, type WorkspacePage } from '../navigation/navigation'

/**
 * One reading a screen wants an operator to leave with.
 *
 * A number on its own is a fact; an insight is a fact plus what it means plus,
 * where one exists, the screen that would change it. Every screen in this
 * console offers between two and four, and they are the first thing under the
 * title — so someone who opens a screen and reads nothing else has still been
 * told the thing the screen exists to say.
 */
export interface Insight {
  hint?: ReactNode
  icon?: IconName
  label: string
  /** Opening the screen that owns this reading. Optional: an insight with
      nowhere to go is still worth stating. */
  onOpen?: () => void
  /** What produced the figure — a probe, a snapshot, an Engine call. */
  source?: ReactNode
  tone?: StatusTone
  /** The console never averages a missing reading into a number. */
  unmeasured?: boolean
  value: string
}

export interface ScreenProps {
  /** One quiet sentence of policy or boundary, under the insights. The kind of
      thing that has to be true but that nobody should have to read twice. */
  about?: ReactNode
  actions?: ReactNode
  children: ReactNode
  insights?: Insight[]
  meta?: ReactNode
  /** The screen this is, in the console's information architecture. The title
      and the one-line purpose are read from it rather than written again, so
      the words on the nav item an operator clicked are the words at the top of
      the screen that opens. */
  page: WorkspacePage
  status?: ReactNode
  /** Replaces the IA summary. Use only where a screen genuinely qualifies its
      own purpose — a detail view of one record, for instance. */
  subtitle?: ReactNode
  /** Replaces the IA label. Same rule as `subtitle`. */
  title?: ReactNode
  width?: PageWidth
}

/**
 * The frame every screen in this console is drawn in.
 *
 * Before it, twenty-four screens each wrote their own `Page` and their own
 * `DetailHeader`, and they had drifted in the way that costs an operator real
 * time: the nav item said "Swarm & placement" and the screen it opened was
 * titled "Infrastructure". Four screens explained themselves in a sentence,
 * six in a paragraph of policy, and fourteen not at all.
 *
 * Title and purpose are therefore read from `navigation.ts` — the same record
 * the rail, the breadcrumb and the palette are drawn from. A screen cannot be
 * called one thing in navigation and another thing in its own heading, because
 * there is only one place the name is written.
 */
export function Screen({ about, actions, children, insights, meta, page, status, subtitle, title, width = 'wide' }: ScreenProps) {
  const entry = pageEntry(page)
  return (
    <Page width={width}>
      <DetailHeader
        actions={actions}
        meta={meta}
        status={status}
        subtitle={subtitle ?? entry.summary}
        title={title ?? entry.label}
      />
      {insights?.length ? <InsightRow insights={insights} label={`What ${entry.label.toLowerCase()} currently reports`} /> : null}
      {about ? <Body size="sm" tone="muted">{about}</Body> : null}
      {children}
    </Page>
  )
}

/**
 * The insight strip. Four tiles at most: a fifth is a table, and a row of
 * equal figures with no ranking has told the reader nothing about which one
 * to look at first.
 */
export function InsightRow({ insights, label }: { insights: Insight[]; label: string }) {
  const shown = insights.slice(0, 4)
  return (
    <MetricGrid aria-label={label} columns={shown.length === 3 ? 3 : shown.length === 2 ? 2 : 4} dense presentation="insights">
      {shown.map((insight) => (
        <Metric
          hint={insight.hint}
          icon={insight.icon}
          key={insight.label}
          label={insight.label}
          onClick={insight.onOpen}
          source={insight.source}
          tone={insight.tone}
          unmeasured={insight.unmeasured}
          value={insight.value}
        />
      ))}
    </MetricGrid>
  )
}

/**
 * A stack of sections inside a screen. Exists so a screen never reaches for a
 * bare `<div>` to get vertical rhythm — `Page` spaces its own children, and a
 * wrapper that is not `Rows` silently loses that spacing.
 */
export function Sections({ children }: { children: ReactNode }) {
  return <Rows gap="md">{children}</Rows>
}
