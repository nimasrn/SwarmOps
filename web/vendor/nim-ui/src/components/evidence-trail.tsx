import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface TrailEntry {
  /** The measurement itself: "1.4 GB free · 2.1 GB required". */
  label: ReactNode
  /** What produced it. */
  source: ReactNode
  /** How old it is, already formatted — "22s ago". The product owns the
   *  formatting because seconds, minutes and sampling windows do not share a
   *  unit, and a component that guessed would be wrong in one of them. */
  age: ReactNode
}

export interface EvidenceTrailProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  entries: TrailEntry[]
  caption?: ReactNode
}

/**
 * Every measurement a conclusion rested on, with its age.
 *
 * Age is the substance here rather than metadata. A conclusion drawn from a
 * five-minute-old reading is a guess wearing a fact's clothes, and listing the
 * ages together — rather than one at a time beside each claim — is what lets a
 * reader see that the whole argument rests on stale ground.
 *
 * Pair it with `CausalChain`, whose links carry the same readings individually.
 * Build the entries FROM the chain rather than assembling them separately: a
 * trail listing a measurement the argument did not use documents reasoning that
 * did not happen.
 */
export function EvidenceTrail({ caption, className, entries, ...props }: EvidenceTrailProps) {
  return (
    <section className={cn('nim-trail', className)} {...props}>
      {caption ? <p className="nim-trail__caption">{caption}</p> : null}
      <dl className="nim-trail__rows">
        {entries.map((entry, index) => (
          <div className="nim-trail__row" key={index}>
            <dt>
              {entry.label}
              <span className="nim-trail__source">{entry.source}</span>
            </dt>
            <dd className="nim-trail__age">{entry.age}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
