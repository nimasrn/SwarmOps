import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export type DiffKind = 'added' | 'context' | 'removed'

export interface DiffLine {
  kind: DiffKind
  text: string
}

export interface DiffProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  lines: DiffLine[]
  /** Names what is being compared, for example `api-gateway · 7c41b8e → 9f2c1ab`. */
  caption?: string
  /** Announced to assistive technology in place of reading every marker. */
  summary?: string
}

/**
 * A before-and-after of a specification, shown before it is applied.
 *
 * `CodeBlock` renders a file; this renders a CHANGE, and the difference
 * matters: an operator approving a deploy is not reading the spec, they are
 * reading what moved. Context lines are dimmed so the eye lands on the two or
 * three lines that are actually the decision.
 *
 * The marker column carries `+` and `-` as text rather than colour alone. A
 * diff distinguished only by red and green fails for roughly one man in twelve,
 * fails in print, and fails in a screenshot pasted into an incident channel —
 * which is precisely where a diff ends up.
 */
export function Diff({ caption, className, lines, summary, ...props }: DiffProps) {
  const added = lines.filter((line) => line.kind === 'added').length
  const removed = lines.filter((line) => line.kind === 'removed').length
  const label = summary ?? `${added} line${added === 1 ? '' : 's'} added, ${removed} removed`

  // Announced before each line so a screen reader distinguishes them. The
  // visible +/- markers are decorative BECAUSE this exists: "plus" read aloud
  // before every added line is noise, and reading nothing at all would make
  // added and removed indistinguishable — which is the failure this component
  // claims to prevent.
  const spoken: Record<DiffKind, string> = { added: 'added', context: '', removed: 'removed' }

  return (
    <figure className={cn('nim-diff', className)} {...props}>
      {caption ? (
        <figcaption className="nim-diff__caption">
          <span>{caption}</span>
          <span className="nim-diff__tally">
            <span className="nim-diff__tally-add">+{added}</span>
            <span className="nim-diff__tally-del">−{removed}</span>
          </span>
        </figcaption>
      ) : null}
      <pre className="nim-diff__body">
        <span className="nim-visually-hidden">{label}</span>
        {lines.map((line, index) => (
          <span className="nim-diff__line" data-kind={line.kind} key={index}>
            {spoken[line.kind] ? <span className="nim-visually-hidden">{spoken[line.kind]}: </span> : null}
            <span aria-hidden="true" className="nim-diff__marker">
              {line.kind === 'added' ? '+' : line.kind === 'removed' ? '−' : ' '}
            </span>
            <span className="nim-diff__text">{line.text}</span>
          </span>
        ))}
      </pre>
    </figure>
  )
}
