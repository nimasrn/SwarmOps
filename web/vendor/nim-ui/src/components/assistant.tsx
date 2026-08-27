import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/components/icon'
import { IconButton } from '@/components/icon-button'
import { cn } from '@/lib/cn'

export interface AssistantStep {
  /** What the assistant did before answering — searched, ran, read. Shown
      collapsed: it is evidence for the answer, not the answer. */
  detail?: ReactNode
  icon?: IconName
  label: string
  status?: 'done' | 'failed' | 'running'
}

export interface AssistantTurn {
  /** Rendered as-is. The kit does not parse markdown: what an assistant's
      output is allowed to contain — which tags, which links, which code
      highlighter — is a security decision, and a component library is the
      wrong place to make it. */
  content: ReactNode
  id: string
  role: 'assistant' | 'user'
  /** Still arriving. Draws the caret and suppresses the actions, which cannot
      be honestly offered for an answer that is not finished. */
  streaming?: boolean
  /** Named sources under the answer. */
  sources?: { href: string; title: string }[]
  steps?: AssistantStep[]
}

export interface AssistantThreadProps {
  className?: string
  /** The composer, pinned under the transcript. */
  composer?: ReactNode
  /** Shown when there are no turns yet — the suggestions a blank thread needs
      to stop being a blank page. */
  empty?: ReactNode
  labels?: Partial<typeof DEFAULT_LABELS>
  /** Copy, retry, rate. Returning nothing for a turn hides the row. */
  onCopy?: (turn: AssistantTurn) => void
  onRetry?: (turn: AssistantTurn) => void
  onRate?: (turn: AssistantTurn, rating: 'down' | 'up') => void
  /** Stopping a streaming answer. The button only exists while one is. */
  onStop?: () => void
  turns: AssistantTurn[]
  /** The assistant's name and mark, shown against its turns. */
  assistant?: { icon?: IconName; name: string }
}

const DEFAULT_LABELS = {
  assistant: 'Assistant',
  copy: 'Copy',
  down: 'Bad answer',
  retry: 'Try again',
  sources: 'Sources',
  steps: 'Steps',
  stop: 'Stop',
  up: 'Good answer',
  you: 'You',
}

/**
 * An assistant transcript: turns down the page, not bubbles across it.
 *
 * The shape is deliberate and different from `Chat`. A conversation between
 * people is short lines alternating quickly, which is what bubbles are for; an
 * answer from a model is a document — paragraphs, lists, code, tables — and a
 * document does not go in a bubble. So the assistant's turn is full measure on
 * the canvas with a mark beside it, and only the viewer's own turn keeps a
 * surface, because that is the one that has to be told apart from the answer.
 *
 * `content` is rendered as given. The kit does not parse markdown or sanitise
 * HTML: what a model's output may contain is a decision with a threat model
 * behind it, and it belongs to the product, once, rather than to a component
 * that would be making it silently for everyone.
 *
 * The transcript follows a streaming answer only while the reader is already
 * at the foot of it — the same rule as `Chat`, and for the same reason.
 */
export function AssistantThread({
  assistant,
  className,
  composer,
  empty,
  labels,
  onCopy,
  onRate,
  onRetry,
  onStop,
  turns,
}: AssistantThreadProps) {
  const text = { ...DEFAULT_LABELS, ...labels }
  const scroller = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)
  const [open, setOpen] = useState<string | null>(null)
  const streaming = turns.some((turn) => turn.streaming)

  useEffect(() => {
    const element = scroller.current
    if (!element || !pinned.current) return
    element.scrollTop = element.scrollHeight
  }, [turns])

  return (
    <section className={cn('nim-assistant', className)}>
      <div
        className="nim-assistant__scroll"
        onScroll={(event) => {
          const element = event.currentTarget
          pinned.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48
        }}
        ref={scroller}
      >
        {turns.length === 0 && empty ? <div className="nim-assistant__empty">{empty}</div> : null}

        <ol aria-live="polite" className="nim-assistant__list">
          {turns.map((turn) => (
            <li className="nim-turn" data-role={turn.role} key={turn.id}>
              <span className="nim-turn__mark">
                {turn.role === 'assistant' ? (
                  <span className="nim-turn__badge">
                    <Icon name={assistant?.icon ?? 'sparkle'} size="sm" />
                  </span>
                ) : null}
              </span>

              <div className="nim-turn__body">
                <span className="nim-turn__who">
                  {turn.role === 'assistant' ? (assistant?.name ?? text.assistant) : text.you}
                </span>

                {turn.steps?.length ? (
                  <div className="nim-turn__steps">
                    <button
                      aria-expanded={open === turn.id}
                      className="nim-turn__steps-toggle"
                      onClick={() => setOpen(open === turn.id ? null : turn.id)}
                      type="button"
                    >
                      <Icon name={open === turn.id ? 'chevron-down' : 'chevron-forward'} size="xs" />
                      {text.steps}
                      <span className="nim-turn__steps-count">{turn.steps.length}</span>
                    </button>
                    {/* Collapsed rather than removed, and `inert` while it is:
                        a panel at zero height whose links are still tabbable is
                        the classic disclosure bug. */}
                    <ul
                      className="nim-turn__step-list"
                      hidden={open !== turn.id}
                      // React 18's typings have no `inert`; the attribute is
                      // real and is what takes the collapsed links out of the
                      // tab order.
                      {...({ inert: open !== turn.id } as { inert?: boolean })}
                    >
                      {turn.steps.map((step) => (
                        <li className="nim-turn__step" data-status={step.status} key={step.label}>
                          <Icon
                            name={
                              step.status === 'failed'
                                ? 'danger'
                                : step.status === 'running'
                                  ? 'loading'
                                  : (step.icon ?? 'check')
                            }
                            size="xs"
                          />
                          <span>{step.label}</span>
                          {step.detail ? <span className="nim-turn__step-detail">{step.detail}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="nim-turn__content" data-streaming={turn.streaming ? 'true' : undefined}>
                  {turn.content}
                </div>

                {turn.sources?.length ? (
                  <ul className="nim-turn__sources">
                    <li className="nim-turn__sources-label">{text.sources}</li>
                    {turn.sources.map((source, index) => (
                      <li key={index}>
                        <a className="nim-turn__source" href={source.href} rel="noreferrer" target="_blank">
                          <span className="nim-turn__source-index">{index + 1}</span>
                          {source.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {turn.role === 'assistant' && !turn.streaming && (onCopy || onRetry || onRate) ? (
                  <div className="nim-turn__actions">
                    {onCopy ? (
                      <IconButton label={text.copy} name="copy" onClick={() => onCopy(turn)} size="sm" />
                    ) : null}
                    {onRetry ? (
                      <IconButton label={text.retry} name="refresh" onClick={() => onRetry(turn)} size="sm" />
                    ) : null}
                    {onRate ? (
                      <>
                        <IconButton label={text.up} name="trend-up" onClick={() => onRate(turn, 'up')} size="sm" />
                        <IconButton label={text.down} name="trend-down" onClick={() => onRate(turn, 'down')} size="sm" />
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ol>

        {streaming && onStop ? (
          <div className="nim-assistant__stop">
            <button className="nim-assistant__stop-button" onClick={onStop} type="button">
              <Icon name="stop" size="sm" />
              {text.stop}
            </button>
          </div>
        ) : null}
      </div>

      {composer ? <div className="nim-assistant__composer">{composer}</div> : null}
    </section>
  )
}
