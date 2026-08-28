import { useCallback, useState } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import { Icon, type IconName } from '@/components/icon'
import { cn } from '@/lib/cn'

/* ═══════════════════════════════════════════════════════════════════════════
   CONSOLE — the layer an admin panel is actually built out of.

   `AdminShell` gave a console its chrome and stopped there, so every panel
   that used it re-invented the same eight things below its topbar: a page
   container, a titled section, a filter/action strip, a row of counters, a
   label/value block, a two-column split, a scrolling log, a status dot. Both
   consumers had grown their own copy — swarmops in 450 lines of app CSS,
   vlora-admin in 6,000 — and the two copies did not agree on a single
   measurement.

   These are those eight, as components, written against the token contract.
   They own layout of their own parts and never outer margin: what separates
   one from the next is `Page`'s rhythm, which is the page's job.
   ═══════════════════════════════════════════════════════════════════════════ */

export type PageWidth = 'content' | 'full' | 'wide'

export interface PageProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  /** `wide` (default) caps at the console reading limit; `content` is the
      prose column, for settings and docs; `full` bleeds to the workspace. */
  width?: PageWidth
}

/**
 * The scrolling body of one console screen.
 *
 * It answers two questions that were previously answered per page: how wide a
 * screen is allowed to get, and how far apart two sections sit. Both are here
 * so a console reads as one document rather than as a set of pages that each
 * chose their own rhythm.
 */
export function Page({ children, className, width = 'wide', ...props }: PageProps) {
  return (
    <div className={cn('nim-page', className)} data-width={width} {...props}>
      {children}
    </div>
  )
}

export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** Buttons for this section — not for the record. Record-level actions
      belong in `DetailHeader`, where they are found without scrolling. */
  actions?: ReactNode
  /** A stage head with nothing to show yet is a legitimate panel: the step
      keeps its place in the column so the procedure does not look shorter
      than it is. */
  children?: ReactNode
  /** Beside the title, on the same line: the status phrase that qualifies the
      heading — "Scan completed just now", "Review and map services". Distinct
      from `description`, which is a sentence and sits under the title. */
  caption?: ReactNode
  description?: ReactNode
  /** Small type above the title: the category, the source, the count. */
  eyebrow?: ReactNode
  footer?: ReactNode
  /** A disc before the heading: the stage number of a procedure, or an icon
      for the kind of thing this section holds. It is decorative — the number
      it carries is already in the heading text of the step it names. */
  marker?: ReactNode
  /** Drop the body padding. A table, a log, or a list draws its own edges and
      an extra 16px inside the panel just moves the rules inward. */
  flush?: boolean
  title?: ReactNode
}

/**
 * A titled section of a console page.
 *
 * The heading level is deliberately `h2`: a console page has exactly one `h1`
 * and it is in the topbar or the detail header. Panels that mint their own
 * `h1` are why these screens read as a stack of unrelated documents to a
 * screen reader.
 */
export function Panel({
  actions,
  caption,
  children,
  className,
  description,
  eyebrow,
  flush = false,
  footer,
  marker,
  title,
  ...props
}: PanelProps) {
  const head = title || caption || description || eyebrow || actions

  return (
    <section className={cn('nim-panel', className)} {...props}>
      {head ? (
        <header className="nim-panel__head">
          {marker ? (
            <span aria-hidden="true" className="nim-panel__marker">
              {marker}
            </span>
          ) : null}
          <div className="nim-panel__heading">
            {eyebrow ? <p className="nim-panel__eyebrow">{eyebrow}</p> : null}
            {title ? (
              <div className="nim-panel__title-row">
                <h2 className="nim-panel__title">{title}</h2>
                {caption ? <p className="nim-panel__caption">{caption}</p> : null}
              </div>
            ) : null}
            {description ? <p className="nim-panel__description">{description}</p> : null}
          </div>
          {actions ? <div className="nim-panel__actions">{actions}</div> : null}
        </header>
      ) : null}
      {children ? (
        <div className="nim-panel__body" data-flush={flush ? 'true' : undefined}>
          {children}
        </div>
      ) : null}
      {footer ? <div className="nim-panel__foot">{footer}</div> : null}
    </section>
  )
}

export interface ToolbarProps extends HTMLAttributes<HTMLDivElement> {
  /** Pushed to the trailing edge. The primary action of the screen lives
      here, in the same place on every screen. */
  actions?: ReactNode
  children?: ReactNode
}

/**
 * The strip above a collection: what narrows it on one side, what can be done
 * to it on the other.
 *
 * It wraps rather than scrolls. A toolbar that scrolls horizontally hides the
 * filter an operator has already applied, and a hidden active filter is the
 * single most common reason a console is reported as showing the wrong data.
 */
export function Toolbar({ actions, children, className, ...props }: ToolbarProps) {
  return (
    <div className={cn('nim-toolbar', className)} role="toolbar" {...props}>
      {children ? <div className="nim-toolbar__group">{children}</div> : null}
      {actions ? <div className="nim-toolbar__actions">{actions}</div> : null}
    </div>
  )
}

/** One status vocabulary for the whole console: the tone on a metric tile,
    the dot in a table row, and the rail on a panel all name the same six
    states, so nothing has to be translated between them. */
export type StatusTone = 'accent' | 'danger' | 'info' | 'neutral' | 'success' | 'warning'

export interface MetricProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onClick'> {
  /** Signed change against the previous period, already formatted. */
  delta?: ReactNode
  deltaDirection?: 'down' | 'up'
  /** Which direction is good. Errors falling is success; revenue falling is
      not, and a tile that colours every rise green lies on half the screens
      it appears on. */
  deltaIntent?: 'less-is-better' | 'more-is-better'
  hint?: ReactNode
  icon?: IconName
  label: ReactNode
  /** `stacked` (default) is the counter tile: label, then the number at the
      size a row of tiles is compared at. `inline` is the evidence chip — the
      icon beside the figure, the name and its qualifier to the side — for a
      strip that reports what a scan FOUND rather than how a number moved. */
  layout?: 'inline' | 'stacked'
  onClick?: () => void
  /** The same vocabulary `StatusDot` speaks — one status language across the
      console, so a tile and the dot in the row it links to cannot disagree. */
  tone?: StatusTone
  value: ReactNode
}

/**
 * One number, its name, and how it moved.
 *
 * The value is set in the numeric face at a fixed size rather than scaled to
 * fit: a row of tiles is read by comparing the numbers, and a tile that shrank
 * its own value to fit "1,284,003" has broken that comparison.
 */
export function Metric({
  className,
  delta,
  deltaDirection = 'up',
  deltaIntent = 'more-is-better',
  hint,
  icon,
  label,
  layout = 'stacked',
  onClick,
  tone = 'neutral',
  value,
  ...props
}: MetricProps) {
  const good =
    deltaIntent === 'more-is-better' ? deltaDirection === 'up' : deltaDirection === 'down'
  const Component = onClick ? 'button' : 'div'

  return (
    <Component
      className={cn('nim-metric', onClick && 'nim-metric--interactive', className)}
      data-layout={layout === 'stacked' ? undefined : layout}
      data-tone={tone === 'neutral' ? undefined : tone}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      {...(props as HTMLAttributes<HTMLElement>)}
    >
      {layout === 'inline' && icon ? (
        <span aria-hidden="true" className="nim-metric__glyph">
          <Icon name={icon} size="sm" />
        </span>
      ) : null}
      {/* DOM order stays label → value: the stacked tile is read that way,
          and the inline form re-places both through grid areas rather than by
          reordering the markup under a screen reader. */}
      <span className="nim-metric__label">
        {layout === 'inline' ? null : icon ? <Icon name={icon} size="xs" /> : null}
        {label}
      </span>
      <span className="nim-metric__value">{value}</span>
      {delta || hint ? (
        <span className="nim-metric__foot">
          {delta ? (
            <span className="nim-metric__delta" data-intent={good ? 'good' : 'bad'}>
              <Icon name={deltaDirection === 'up' ? 'trend-up' : 'trend-down'} size="xs" />
              {delta}
            </span>
          ) : null}
          {hint ? <span className="nim-metric__hint">{hint}</span> : null}
        </span>
      ) : null}
    </Component>
  )
}

export interface MetricGridProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  /** For a row of chip-form tiles (`Metric layout="inline"`). A chip stays
      legible at roughly half the width a counter tile needs, so it holds its
      column count much further down before stepping — without this the
      evidence strip folds to two-up inside any panel that has a rail beside
      it, which is every screen it appears on. */
  dense?: boolean
  /** The count at full width. It steps down on its own below that — the grid
      is a container query, so a row of tiles inside a narrow panel wraps like
      a row of tiles on a narrow screen. */
  columns?: 2 | 3 | 4 | 5 | 6
}

export function MetricGrid({ children, className, columns = 4, dense = false, ...props }: MetricGridProps) {
  return (
    <div
      className={cn('nim-metric-grid', className)}
      data-columns={columns}
      data-dense={dense ? 'true' : undefined}
      {...props}
    >
      {children}
    </div>
  )
}

export interface Fact {
  /** Machine-shaped values — ids, hashes, hosts, durations — set in the mono
      face so they can be compared and copied without being misread. */
  mono?: boolean
  key?: string
  label: ReactNode
  value: ReactNode
}

export interface FactsProps extends HTMLAttributes<HTMLDListElement> {
  columns?: 1 | 2 | 3
  items: Fact[]
}

/**
 * The properties of a record, as a real `<dl>`.
 *
 * Two divs and a colon would look the same and carry none of the association
 * that lets a screen reader answer "what is the region of this node?" — which
 * is the entire question this block exists to answer.
 */
export function Facts({ className, columns = 2, items, ...props }: FactsProps) {
  return (
    <dl className={cn('nim-facts', className)} data-columns={columns} {...props}>
      {items.map((fact, index) => (
        <div className="nim-facts__item" key={fact.key ?? index}>
          <dt className="nim-facts__label">{fact.label}</dt>
          <dd className="nim-facts__value" data-mono={fact.mono ? 'true' : undefined}>
            {fact.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export type ColumnsTemplate = 'aside' | 'aside-start' | 'halves' | 'one-third' | 'quarters' | 'thirds' | 'two-fifths' | 'two-thirds'

export interface ColumnsProps extends HTMLAttributes<HTMLDivElement> {
  /** `stretch` (the default) gives both columns the row's height, which is
      right when they are two halves of one object. `start` sizes each to its
      own content — use it when the columns are INDEPENDENT panels whose
      lengths have no reason to agree, such as a list that varies from zero to
      four rows beside a fixed set of four. Stretched, the shorter one becomes
      a tall box with its content stranded at the top. */
  align?: 'start' | 'stretch'
  children: ReactNode
  /** `aside` is a main column plus a fixed rail; `halves` and `thirds` are
      equal tracks. All of them collapse to one column in a narrow container. */
  template?: ColumnsTemplate
}

export function Columns({ align = 'stretch', children, className, template = 'halves', ...props }: ColumnsProps) {
  return (
    <div className={cn('nim-columns', className)} data-align={align === 'start' ? 'start' : undefined} data-template={template} {...props}>
      {children}
    </div>
  )
}

export interface StatusHeroProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** What to DO about the verdict. A control room that states a condition and
      offers nothing has left the reader to go and find the screen themselves,
      which is the moment an incident costs its first minutes. Keep it to the
      one recommended action; a hero with a row of equal buttons has ranked
      nothing. */
  actions?: ReactNode
  description?: ReactNode
  icon: IconName
  title: ReactNode
  tone?: StatusTone
}

/** A large first-glance health statement for a control-room overview. */
export function StatusHero({ actions, className, description, icon, title, tone = 'neutral', ...props }: StatusHeroProps) {
  return (
    <section className={cn('nim-status-hero', className)} data-tone={tone} {...props}>
      <span className="nim-status-hero__mark"><Icon name={icon} size="xl" /></span>
      <div className="nim-status-hero__copy">
        <strong className="nim-status-hero__title">{title}</strong>
        {description ? <p className="nim-status-hero__description">{description}</p> : null}
      </div>
      {actions ? <div className="nim-status-hero__actions">{actions}</div> : null}
    </section>
  )
}

export interface CodeBlockProps extends Omit<HTMLAttributes<HTMLPreElement>, 'children'> {
  /** The text itself. A string rather than nodes, so it can be copied — a log
      an operator cannot paste into a ticket has failed at its one job. */
  children: string
  copyLabel?: string
  copiedLabel?: string
  /** Above the block: the file, the command, the stream it came from. */
  label?: ReactNode
  /** Off by default. Log lines are read by their leading columns and wrapping
      destroys that alignment; a stack trace or a payload wants it on. */
  wrap?: boolean
}

/**
 * Machine output, in a box that scrolls instead of growing.
 *
 * Height is capped at `--nim-scroller-max` because the alternative — a panel
 * that grows to the length of the log — pushes every action on the page below
 * the fold exactly when something has gone wrong.
 */
export function CodeBlock({
  children,
  className,
  copiedLabel = 'Copied',
  copyLabel = 'Copy',
  label,
  wrap = false,
  ...props
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const canCopy = typeof navigator !== 'undefined' && Boolean(navigator.clipboard)

  const copy = useCallback(() => {
    void navigator.clipboard.writeText(children).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    })
  }, [children])

  return (
    <figure className={cn('nim-code', className)}>
      {label || canCopy ? (
        <figcaption className="nim-code__head">
          {label ? <span className="nim-code__label">{label}</span> : <span />}
          {canCopy ? (
            <button className="nim-code__copy" onClick={copy} type="button">
              <Icon name={copied ? 'check' : 'copy'} size="xs" />
              {copied ? copiedLabel : copyLabel}
            </button>
          ) : null}
        </figcaption>
      ) : null}
      <pre className="nim-code__body" data-wrap={wrap ? 'true' : undefined} tabIndex={0} {...props}>
        {children}
      </pre>
    </figure>
  )
}

export interface StatusDotProps extends HTMLAttributes<HTMLSpanElement> {
  /** Always render the word. Colour alone is not a status: it fails for a
      colour-blind operator and it fails in a screenshot pasted into a ticket. */
  children?: ReactNode
  /** A slow halo for something in flight — provisioning, draining, deploying. */
  pulse?: boolean
  tone?: StatusTone
}

export function StatusDot({ children, className, pulse = false, tone = 'neutral', ...props }: StatusDotProps) {
  return (
    <span className={cn('nim-status', className)} data-tone={tone} {...props}>
      <span aria-hidden="true" className="nim-status__dot" data-pulse={pulse ? 'true' : undefined} />
      {children}
    </span>
  )
}

export interface MonoProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode
  /** Set it smaller than the text around it. A hash inline in a sentence at
      the same size as the sentence swamps it; in a table cell of its own it
      should stay at the row's size. */
  size?: 'inherit' | 'sm'
}

/**
 * Machine text inline: an id, a host, a digest, a duration, a version.
 *
 * Tabular figures and `anywhere` breaking, because the two things anyone does
 * with one of these is compare it against another and paste it somewhere else,
 * and a proportional face defeats the first while `nowrap` defeats the second
 * by pushing the value out of its cell.
 */
export function Mono({ children, className, size = 'sm', ...props }: MonoProps) {
  return (
    <code className={cn('nim-mono', className)} data-size={size} {...props}>
      {children}
    </code>
  )
}

export interface RecordLinkProps {
  className?: string
  href?: string
  /** The machine identity under the human one: id, host, sku, digest. */
  meta?: ReactNode
  onClick?: () => void
  title: ReactNode
}

/**
 * The identity cell of a table row: what the record is called, and the id it
 * is called by everywhere else.
 *
 * Both consumers had written this cell by hand, and both had written it as a
 * `<div onClick>`. It is a real button or a real link here, so the row can be
 * reached with a keyboard and opened in a new tab.
 */
export function RecordLink({ className, href, meta, onClick, title }: RecordLinkProps) {
  const body = (
    <>
      <strong className="nim-record__title">{title}</strong>
      {meta ? <span className="nim-record__meta">{meta}</span> : null}
    </>
  )

  if (href) {
    return (
      <a className={cn('nim-record', className)} href={href}>
        {body}
      </a>
    )
  }
  if (onClick) {
    return (
      <button className={cn('nim-record', className)} onClick={onClick} type="button">
        {body}
      </button>
    )
  }
  return <span className={cn('nim-record', className)}>{body}</span>
}

export interface RailProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** One control beside the title — save, edit, reset. */
  actions?: ReactNode
  children: ReactNode
  /** The commitment: the button this whole rail exists to justify, plus
      whatever explains why it is disabled. */
  footer?: ReactNode
  title: ReactNode
}

/**
 * The standing summary of what a long screen is about to do.
 *
 * A procedure spread over five sections is read from the top, but it is
 * COMMITTED to from one place, and that place has to say what the commitment
 * covers without the operator scrolling back through the decisions that
 * produced it. So the rail sticks: the plan, its warnings, and the button stay
 * on screen while the sections beside it are worked through.
 *
 * It is not a `Panel`. A panel is a section OF the page and scrolls with it;
 * this is a fixture beside the page, and giving `Panel` a `sticky` flag would
 * have let any section of any console page claim the same privilege.
 */
export function Rail({ actions, children, className, footer, title, ...props }: RailProps) {
  return (
    <section className={cn('nim-rail', className)} {...props}>
      <header className="nim-rail__head">
        <h2 className="nim-rail__title">{title}</h2>
        {actions ? <div className="nim-rail__actions">{actions}</div> : null}
      </header>
      <div className="nim-rail__body">{children}</div>
      {footer ? <div className="nim-rail__foot">{footer}</div> : null}
    </section>
  )
}

export interface RailSectionProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  children: ReactNode
  /** The count, on the trailing edge: "2 services", "3 stacks". */
  meta?: ReactNode
  /** Colours the heading only. A rail's warnings and blockers are told apart
      by their heading, not by tinting the whole block — a rail whose every
      group carries a background is a rail with no emphasis left to spend. */
  tone?: StatusTone
  title?: ReactNode
}

export function RailSection({ children, className, meta, title, tone = 'neutral', ...props }: RailSectionProps) {
  return (
    <div
      className={cn('nim-rail__section', className)}
      data-tone={tone === 'neutral' ? undefined : tone}
      {...props}
    >
      {title ? (
        <p className="nim-rail__section-head">
          <span className="nim-rail__section-title">{title}</span>
          {meta ? <span className="nim-rail__section-meta">{meta}</span> : null}
        </p>
      ) : null}
      {children}
    </div>
  )
}

export interface CopyChipProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** The text itself, and what is copied. A digest, an id, a host. */
  children: string
  copiedLabel?: string
  copyLabel?: string
}

/**
 * One machine value, set in the mono face, with the copy affordance beside it.
 *
 * `CodeBlock` already does this for a block of output; a digest in a summary
 * row is a single token, and putting a scrolling `<pre>` around it to get a
 * copy button is why these values end up being retyped by hand instead.
 */
export function CopyChip({
  children,
  className,
  copiedLabel = 'Copied',
  copyLabel = 'Copy',
  ...props
}: CopyChipProps) {
  const [copied, setCopied] = useState(false)
  const canCopy = typeof navigator !== 'undefined' && Boolean(navigator.clipboard)

  const copy = useCallback(() => {
    void navigator.clipboard.writeText(children).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    })
  }, [children])

  return (
    <span className={cn('nim-copy-chip', className)} {...props}>
      <span className="nim-copy-chip__value">{children}</span>
      {canCopy ? (
        <button
          aria-label={copied ? copiedLabel : `${copyLabel} ${children}`}
          className="nim-copy-chip__button"
          onClick={copy}
          type="button"
        >
          <Icon name={copied ? 'check' : 'copy'} size="xs" />
        </button>
      ) : null}
    </span>
  )
}

export interface DetailLayoutProps extends HTMLAttributes<HTMLDivElement> {
  /** The rail: status, ownership, timestamps, related records. */
  aside?: ReactNode
  children: ReactNode
}

/**
 * A record page: the body, and the rail of facts beside it.
 *
 * The rail comes after the body in source order and is placed beside it by the
 * grid, so a narrow container and a screen reader both get the record before
 * its metadata.
 */
export function DetailLayout({ aside, children, className, ...props }: DetailLayoutProps) {
  return (
    <div className={cn('nim-detail', className)} {...props}>
      <div className="nim-detail__main">{children}</div>
      {aside ? <aside className="nim-detail__aside">{aside}</aside> : null}
    </div>
  )
}
