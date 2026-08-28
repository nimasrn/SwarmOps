import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export interface CommandListProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  commands: string[]
  /** Marks the step that costs judgement rather than a query — usually the
   *  last. Given as an index so the caller decides; a component that always
   *  emphasised the final line would be wrong for a sequence that ends easily. */
  costlyIndex?: number
  /** One line on what the costly step actually demands of the reader. */
  note?: string
}

/**
 * A sequence of shell commands, numbered, with the expensive one marked.
 *
 * This exists for showing what a task costs SOMEWHERE ELSE — the manual path a
 * product is replacing. That is a claim, so it renders as evidence rather than
 * as marketing: real commands in the mono face, in order, with the step that
 * requires a human judgement called out instead of buried in the middle of a
 * list where it reads like any other line.
 *
 * Do not use it for commands the reader should run. A copyable block belongs to
 * `CodeBlock`, which offers the copy affordance this deliberately does not:
 * these commands are an argument, and inviting someone to run them here would
 * be inviting them to leave.
 */
export function CommandList({ className, commands, costlyIndex, note, ...props }: CommandListProps) {
  return (
    <div className={cn('nim-commands', className)} {...props}>
      <ol className="nim-commands__list">
        {commands.map((command, index) => (
          <li
            className="nim-commands__item"
            data-costly={index === costlyIndex ? 'true' : undefined}
            key={command}
          >
            {command}
          </li>
        ))}
      </ol>
      {note ? <p className="nim-commands__note">{note}</p> : null}
    </div>
  )
}
