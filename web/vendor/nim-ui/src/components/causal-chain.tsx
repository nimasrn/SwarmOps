import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type CausalLinkTone = 'danger' | 'neutral' | 'success' | 'warning'

export interface CausalLink {
  /** The claim this link makes, in one sentence. */
  claim: ReactNode
  /** The measurement that supports the claim — a figure, not a restatement. */
  evidence?: ReactNode
  /** Where the measurement came from and how old it is. */
  source?: ReactNode
  /** The connective printed on the rail: `observed`, `because`, and so on. */
  step?: ReactNode
  tone?: CausalLinkTone
}

export interface CausalChainProps extends Omit<HTMLAttributes<HTMLOListElement>, 'children'> {
  links: CausalLink[]
  /** Rendered after the last link, on the accent ground: the thing to do. */
  resolution?: ReactNode
  /** Rendered under the chain on the hatched ground: what it cannot see. */
  caveat?: ReactNode
}

/**
 * A diagnosis, written as a chain of claims each carrying its own evidence.
 *
 * The pattern this replaces is a log viewer next to a metric panel, which asks
 * the operator to do the reasoning. A chain does the reasoning and shows its
 * work: every link states what is believed, the measurement behind it, and
 * where that measurement came from — so a wrong link is visibly wrong at the
 * step where it went wrong, rather than producing a confident wrong answer.
 *
 * The first link is the observation the operator arrived with; each subsequent
 * link explains the one above it. The chain must stop at something the product
 * can act on — a chain that ends in an explanation with no action has diagnosed
 * nothing.
 *
 * A link WITHOUT `evidence` renders as an assertion, and looks weaker than its
 * neighbours on purpose: an unevidenced step in a causal argument is exactly
 * the thing a reader should distrust, and the component should not disguise it.
 */
export function CausalChain({ caveat, className, links, resolution, ...props }: CausalChainProps) {
  return (
    <div className={cn('nim-causal', className)}>
      <ol className="nim-causal__list" {...props}>
        {links.map((link, index) => (
          <li
            className="nim-causal__link"
            data-lead={index === 0 ? 'true' : undefined}
            data-tone={link.tone ?? 'neutral'}
            data-unevidenced={link.evidence ? undefined : 'true'}
            key={index}
          >
            <div aria-hidden="true" className="nim-causal__rail">
              <span className="nim-causal__node" />
              {index < links.length - 1 ? <span className="nim-causal__thread" /> : null}
            </div>
            <div className="nim-causal__body">
              {link.step ? <span className="nim-causal__step">{link.step}</span> : null}
              <p className="nim-causal__claim">{link.claim}</p>
              {link.evidence || link.source ? (
                <p className="nim-causal__proof">
                  {link.evidence ? <span className="nim-causal__evidence">{link.evidence}</span> : null}
                  {link.source ? <span className="nim-causal__source">{link.source}</span> : null}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      {resolution ? <div className="nim-causal__resolution">{resolution}</div> : null}
      {caveat ? <div className="nim-causal__caveat">{caveat}</div> : null}
    </div>
  )
}
