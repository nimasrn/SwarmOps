import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface DecideBarProps extends HTMLAttributes<HTMLDivElement> {
  /** What the reader should know before choosing — usually what is already
   *  true regardless of which way they go. */
  note?: ReactNode
  /** The controls. Order them so the safe one comes first: a reader moving
   *  left to right should reach "do nothing" before "do the thing". */
  children: ReactNode
}

/**
 * The moment a screen hands a decision back.
 *
 * A preview, a plan, a proposed change — each is only worth computing if there
 * is a point at which someone can decline it. This bar is that point, and it is
 * separated by a rule because a decision made mid-scroll is not a decision.
 *
 * The note is not fine print. It is for the thing that stays true whichever
 * button is pressed — that the preview was recorded, that nothing has been
 * queued — so the reader is not choosing under a misapprehension.
 */
export function DecideBar({ children, className, note, ...props }: DecideBarProps) {
  return (
    <div className={cn('nim-decide', className)} {...props}>
      {note ? <p className="nim-decide__note">{note}</p> : null}
      <div className="nim-decide__actions">{children}</div>
    </div>
  )
}
