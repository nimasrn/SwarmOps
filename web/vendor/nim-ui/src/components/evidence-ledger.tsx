import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** A figure the product measured, with the thing that produced it named. */
export interface LedgerReading {
  label: ReactNode
  value: ReactNode
  /** What produced the figure: an instrument, a probe, an API. A reading whose
   *  source cannot be named is not a reading, it is a number. */
  source: ReactNode
}

/** Something the product does not know, and why. */
export interface LedgerAbsence {
  label: ReactNode
  /** Usually a dash or a word like "unknown" — never a zero, which reads as a
   *  measurement of nothing rather than an absence of measurement. */
  value: ReactNode
  why: ReactNode
}

export interface EvidenceLedgerProps extends HTMLAttributes<HTMLDivElement> {
  measured: LedgerReading[]
  absent: LedgerAbsence[]
  /** Right of the "measured" heading: usually coverage, e.g. "4/4 probes". */
  coverage?: ReactNode
  labels?: { measured?: ReactNode; absent?: ReactNode; excluded?: ReactNode }
}

/**
 * Two columns: what is measured, and what is not evidence.
 *
 * Most consoles present both halves in one grid, which quietly invites the
 * reader to average across them — and an absence averaged into a figure is how
 * a dashboard reports a number nobody measured. Here the distinction is the
 * layout, so a figure and a gap can never be mistaken for each other.
 *
 * The absent column is hatched for the reason `Caveat` is: the marker has to
 * survive greyscale, print, and a screenshot pasted into an incident channel.
 *
 * It is not a failure state. On a freshly installed system the right column is
 * longer than the left, and that is the honest first impression of something
 * nobody has instrumented yet — the design should not flinch from it.
 */
export function EvidenceLedger({
  absent,
  className,
  coverage,
  labels,
  measured,
  ...props
}: EvidenceLedgerProps) {
  return (
    <div className={cn('nim-ledger', className)} {...props}>
      <section className="nim-ledger__col" data-kind="measured">
        <header className="nim-ledger__head">
          <span>{labels?.measured ?? 'Measured'}</span>
          {coverage ? <span className="nim-ledger__coverage">{coverage}</span> : null}
        </header>
        <dl className="nim-ledger__rows">
          {measured.map((row, index) => (
            <div className="nim-ledger__row" key={index}>
              <dt>
                {row.label}
                <span className="nim-ledger__meta">{row.source}</span>
              </dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="nim-ledger__col" data-kind="absent">
        <header className="nim-ledger__head">
          <span>{labels?.absent ?? 'Not evidence'}</span>
          <span className="nim-ledger__coverage">{labels?.excluded ?? 'excluded from every figure'}</span>
        </header>
        <dl className="nim-ledger__rows">
          {absent.map((row, index) => (
            <div className="nim-ledger__row" key={index}>
              <dt>
                {row.label}
                <span className="nim-ledger__meta">{row.why}</span>
              </dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}
