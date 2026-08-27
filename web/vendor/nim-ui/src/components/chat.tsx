import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Avatar } from '@/components/avatar'
import { Icon } from '@/components/icon'
import { IconButton } from '@/components/icon-button'
import { Menu, type MenuItem } from '@/components/menu'
import { Spinner } from '@/components/feedback'
import { cn } from '@/lib/cn'

/** What a message carries. Text is a string; the rest is an attachment. */
export type ChatMediaKind = 'file' | 'image' | 'text' | 'video' | 'voice'

export interface ChatAttachment {
  /** Seconds. Voice and video only — a duration the viewer sees before playing. */
  duration?: number
  kind: Exclude<ChatMediaKind, 'text'>
  name?: string
  /** Still frame for a video. Without one the browser draws its own first frame. */
  poster?: string
  /** Bytes. Shown on files so nobody taps a 40MB download on mobile data. */
  size?: number
  /** Object URL or remote URL. The kit never uploads anything itself. */
  url: string
  /** Normalised 0–1 samples for a voice message. Absent draws a flat track. */
  waveform?: number[]
}

export interface ChatReaction {
  count: number
  emoji: string
  /** Whether the viewer is one of the count. It is what turns the pill into a
      toggle rather than a tally. */
  mine?: boolean
}

export interface ChatQuote {
  author: string
  /** The quoted message, so tapping the quote can scroll to it. */
  id: string
  text: string
}

export interface ChatMessage {
  attachments?: ChatAttachment[]
  /** Who wrote it. `own` messages are the viewer's and sit on the trailing edge. */
  author?: { avatar?: string; name: string }
  /** A rich block inside the bubble — a chart, a map, a link preview. The kit
      renders whatever is passed and knows nothing about it, which is how a
      transcript carries a graph without the chat depending on the chart. */
  card?: ReactNode
  /** Retracted. The bubble stays — a message that vanishes leaves the reply
      above it answering nothing — and says so instead of showing the text. */
  deleted?: boolean
  edited?: boolean
  id: string
  own?: boolean
  reactions?: ChatReaction[]
  /** What this message is a reply to, quoted above it. */
  replyTo?: ChatQuote
  /** Delivery state, shown on own messages only — the other side's receipts
      are not the viewer's business. */
  status?: 'failed' | 'read' | 'sending' | 'sent'
  /** A notice from the room rather than a person: "Sara joined", "Pinned by
      Amir". Centred, unbubbled, never attributed to a speaker. */
  system?: boolean
  text?: string
  /** ISO timestamp. Formatted in the viewer's locale, never by the caller. */
  at?: string
}

export interface ChatProps {
  /** The per-message action menu. Returning an empty list for a message hides
      its trigger, which is how a product says "not this one" — a deleted
      message, someone else's, one still sending. */
  actions?: (message: ChatMessage) => MenuItem[]
  className?: string
  /** The composer. Passing none makes the transcript read-only, which is what
      an archive or a shared thread wants. */
  composer?: ReactNode
  /** Rendered under the last message — a date divider, a system notice. */
  footer?: ReactNode
  /** Header row: who this conversation is with, and its actions. */
  header?: ReactNode
  /** Names and avatars on every run, not just where the speaker changes. Set
      it for a group or a channel; in a one-to-one it is noise, because there
      is only one other person it could be. */
  group?: boolean
  /** Accessible names and the few words the transcript itself says. */
  labels?: Partial<typeof DEFAULT_LABELS>
  locale?: string
  messages: ChatMessage[]
  /** Called when a quoted reply is tapped, with the id of the message being
      quoted. Scrolling to it is the app's: only it knows whether that message
      is still in the page or has to be paged back in. */
  onJump?: (id: string) => void
  /** Adding or removing the viewer's reaction. Unset hides the affordance. */
  onReact?: (message: ChatMessage, emoji: string) => void
  /** The quick reactions offered on the bubble. Six is the platform norm and
      about as many as anyone scans without reading. */
  reactions?: string[]
  /** How long a pause ends a run of messages, in seconds. */
  runGap?: number
  /** Someone is typing. A name renders "Sara is typing", bare `true` renders
      the dots alone. */
  typing?: boolean | string
}

const DEFAULT_LABELS = {
  deleted: 'Message deleted',
  download: 'Download',
  edited: 'edited',
  failed: 'Not delivered',
  more: 'Message actions',
  pause: 'Pause',
  play: 'Play',
  react: 'Add a reaction',
  read: 'Read',
  reply: 'Reply',
  sending: 'Sending',
  sent: 'Sent',
  today: 'Today',
  typing: 'is typing',
  voiceMessage: 'Voice message',
  yesterday: 'Yesterday',
}

const DEFAULT_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

const KB = 1024
const DAY = 86_400_000

/** `1.4 MB`. Sizes are read at a glance, so one decimal is enough. */
function formatSize(bytes: number, locale: string | undefined): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= KB && unit < units.length - 1) {
    value /= KB
    unit += 1
  }
  const digits = new Intl.NumberFormat(locale, { maximumFractionDigits: unit === 0 ? 0 : 1 })
  return `${digits.format(value)} ${units[unit]}`
}

/** `1:07`. Clock time, not a duration sentence — it sits inside a bubble. */
function formatDuration(seconds: number, locale: string | undefined): string {
  const digits = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, useGrouping: false })
  const whole = Math.max(0, Math.round(seconds))
  const minutes = new Intl.NumberFormat(locale).format(Math.floor(whole / 60))
  return `${minutes}:${digits.format(whole % 60)}`
}

/** Midnight local. Two messages are on the same day if these agree. */
const dayOf = (iso: string) => {
  const date = new Date(iso)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/**
 * A voice message: one control, a scrubbable waveform, and the time left.
 *
 * The `<audio>` element is real and hidden rather than reimplemented — it is
 * what gives the message a decoder, the OS media keys, and playback that keeps
 * going when the tab is backgrounded. Only the transport is drawn here.
 */
function VoiceBubble({
  attachment,
  labels,
  locale,
}: {
  attachment: ChatAttachment
  labels: typeof DEFAULT_LABELS
  locale: string | undefined
}) {
  const audio = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const total = attachment.duration ?? 0
  const bars = useMemo(
    () => attachment.waveform ?? Array.from({ length: 32 }, (_, index) => 0.35 + ((index * 7) % 11) / 18),
    [attachment.waveform],
  )
  const progress = total > 0 ? Math.min(1, position / total) : 0

  return (
    <div className="nim-chat-voice">
      <IconButton
        label={playing ? labels.pause : labels.play}
        name={playing ? 'pause' : 'play'}
        onClick={() => {
          const element = audio.current
          if (!element) return
          if (element.paused) void element.play()
          else element.pause()
        }}
        size="sm"
        variant="solid"
      />
      <div
        aria-label={labels.voiceMessage}
        className="nim-chat-voice__wave"
        // The waveform is decoration over a real control; it is the button and
        // the time that carry the message for anyone not looking at it.
        aria-hidden="true"
      >
        {bars.map((bar, index) => (
          <span
            className="nim-chat-voice__bar"
            data-played={index / bars.length <= progress ? 'true' : undefined}
            key={index}
            style={{ blockSize: `${Math.round(bar * 100)}%` }}
          />
        ))}
      </div>
      <span className="nim-chat-voice__time">
        {formatDuration(playing || position ? Math.max(0, total - position) : total, locale)}
      </span>
      <audio
        onEnded={() => {
          setPlaying(false)
          setPosition(0)
        }}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
        preload="metadata"
        ref={audio}
        src={attachment.url}
      />
    </div>
  )
}

function AttachmentView({
  attachment,
  labels,
  locale,
}: {
  attachment: ChatAttachment
  labels: typeof DEFAULT_LABELS
  locale: string | undefined
}) {
  if (attachment.kind === 'voice') {
    return <VoiceBubble attachment={attachment} labels={labels} locale={locale} />
  }

  if (attachment.kind === 'video') {
    return (
      <figure className="nim-chat-media">
        {/* Controls come from the platform: picture-in-picture, captions,
            AirPlay and the scrubber are all things a custom player loses. */}
        <video controls playsInline poster={attachment.poster} preload="metadata" src={attachment.url} />
        {attachment.duration ? (
          <figcaption className="nim-chat-media__meta">
            {formatDuration(attachment.duration, locale)}
          </figcaption>
        ) : null}
      </figure>
    )
  }

  if (attachment.kind === 'image') {
    return (
      <figure className="nim-chat-media">
        <img alt={attachment.name ?? ''} loading="lazy" src={attachment.url} />
      </figure>
    )
  }

  return (
    <a
      className="nim-chat-file"
      download={attachment.name}
      href={attachment.url}
      rel="noreferrer"
      target="_blank"
    >
      <span className="nim-chat-file__icon">
        <Icon name="document" size="md" />
      </span>
      <span className="nim-chat-file__text">
        <span className="nim-chat-file__name">{attachment.name ?? labels.download}</span>
        {attachment.size !== undefined ? (
          <span className="nim-chat-file__size">{formatSize(attachment.size, locale)}</span>
        ) : null}
      </span>
      <Icon className="nim-chat-file__action" name="download" size="sm" />
    </a>
  )
}

/** Reactions under a bubble: a tally that is also the control that changes it. */
function Reactions({
  labels,
  message,
  onReact,
}: {
  labels: typeof DEFAULT_LABELS
  message: ChatMessage
  onReact: ChatProps['onReact']
}) {
  return (
    <ul className="nim-chat-reactions">
      {message.reactions?.map((reaction) => (
        <li key={reaction.emoji}>
          <button
            aria-pressed={reaction.mine ? 'true' : 'false'}
            className="nim-chat-reaction"
            disabled={!onReact}
            onClick={() => onReact?.(message, reaction.emoji)}
            type="button"
          >
            <span aria-hidden="true">{reaction.emoji}</span>
            <span className="nim-chat-reaction__count">{reaction.count}</span>
            <span className="nim-visually-hidden">{labels.react}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/**
 * One conversation: a scrolling transcript with a composer under it.
 *
 * The transcript is a `<ol>` in a live region, so a message arriving is
 * announced without stealing focus from whatever the viewer is typing. It
 * follows the newest message only when the viewer is already at the bottom —
 * yanking someone back down while they are reading history is the single most
 * common chat bug, and it is a scroll check, not a scroll call.
 *
 * Consecutive messages from one person within `runGap` are a RUN: one avatar,
 * one name, one timestamp, and a tail on the last bubble only. This is the
 * whole difference between a transcript that reads like a conversation and one
 * that reads like a log, and it is why the meta lines are attached to the run
 * rather than to every message.
 *
 * Media is played by the platform's own elements. The kit renders transports
 * and bubbles; it never uploads, transcodes, or holds a socket.
 */
export function Chat({
  actions,
  className,
  composer,
  footer,
  group = false,
  header,
  labels,
  locale,
  messages,
  onJump,
  onReact,
  reactions = DEFAULT_REACTIONS,
  runGap = 300,
  typing,
}: ChatProps) {
  const text = { ...DEFAULT_LABELS, ...labels }
  const scroller = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)

  const timeFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }),
    [locale],
  )
  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', weekday: 'long' }),
    [locale],
  )

  /** Runs and day breaks, resolved once so the render is a straight map. */
  const rows = useMemo(() => {
    const today = dayOf(new Date().toISOString())
    return messages.map((message, index) => {
      const previous = messages[index - 1]
      const next = messages[index + 1]

      const day = message.at ? dayOf(message.at) : null
      const previousDay = previous?.at ? dayOf(previous.at) : null
      const divider =
        day !== null && day !== previousDay
          ? day === today
            ? text.today
            : day === today - DAY
              ? text.yesterday
              : dateFormat.format(new Date(message.at as string))
          : null

      const sameSpeaker = (a: ChatMessage | undefined, b: ChatMessage) =>
        Boolean(a) &&
        !a?.system &&
        !b.system &&
        Boolean(a?.own) === Boolean(b.own) &&
        a?.author?.name === b.author?.name

      const near = (a: ChatMessage | undefined, b: ChatMessage) =>
        !a?.at || !b.at || Math.abs(new Date(b.at).getTime() - new Date(a.at).getTime()) <= runGap * 1000

      const first = divider !== null || !sameSpeaker(previous, message) || !near(previous, message)
      const last =
        !next ||
        (next.at ? dayOf(next.at) : null) !== day ||
        !sameSpeaker(next, message) ||
        !near(message, next)

      return { divider, first, last, message }
    })
  }, [dateFormat, messages, runGap, text.today, text.yesterday])

  useEffect(() => {
    const element = scroller.current
    if (!element || !pinned.current) return
    element.scrollTop = element.scrollHeight
  }, [messages, typing])

  return (
    <section className={cn('nim-chat', className)}>
      {header ? <header className="nim-chat__header">{header}</header> : null}

      <div
        className="nim-chat__scroll"
        onScroll={(event) => {
          const element = event.currentTarget
          // 48px of slack: "near the bottom" is what a reader means by "at the
          // bottom", and an exact comparison fails on fractional zoom.
          pinned.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48
        }}
        ref={scroller}
      >
        <ol aria-live="polite" className="nim-chat__list">
          {rows.map(({ divider, first, last, message }) => {
            if (message.system) {
              return (
                <Fragment key={message.id}>
                  {divider ? <li className="nim-chat__day">{divider}</li> : null}
                  <li className="nim-chat__system">{message.text}</li>
                </Fragment>
              )
            }

            const menu = actions?.(message) ?? []
            const showAuthor = first && !message.own && (group || Boolean(message.author))

            return (
              <Fragment key={message.id}>
                {divider ? <li className="nim-chat__day">{divider}</li> : null}
                <li
                  className={cn('nim-chat-message', message.own && 'nim-chat-message--own')}
                  data-first={first ? 'true' : undefined}
                  data-last={last ? 'true' : undefined}
                  id={`nim-message-${message.id}`}
                >
                  {/* The avatar column is held open through the whole run so
                      the bubbles of one speaker stay on one edge; only the last
                      bubble in the run actually gets a face. */}
                  {!message.own ? (
                    <span className="nim-chat-message__gutter">
                      {last && message.author ? (
                        <Avatar name={message.author.name} size="sm" src={message.author.avatar} />
                      ) : null}
                    </span>
                  ) : null}

                  <div className="nim-chat-message__stack">
                    {showAuthor && message.author ? (
                      <span className="nim-chat-message__author">{message.author.name}</span>
                    ) : null}

                    <div className="nim-chat-message__row">
                      <div className="nim-chat-message__bubble" data-deleted={message.deleted ? 'true' : undefined}>
                        {message.replyTo ? (
                          <button
                            className="nim-chat-quote"
                            disabled={!onJump}
                            onClick={() => onJump?.(message.replyTo!.id)}
                            type="button"
                          >
                            <span className="nim-chat-quote__author">{message.replyTo.author}</span>
                            <span className="nim-chat-quote__text">{message.replyTo.text}</span>
                          </button>
                        ) : null}

                        {message.deleted ? (
                          <p className="nim-chat-message__text nim-chat-message__text--gone">
                            <Icon name="trash" size="xs" /> {text.deleted}
                          </p>
                        ) : (
                          <>
                            {message.attachments?.map((attachment, index) => (
                              <AttachmentView
                                attachment={attachment}
                                key={`${message.id}-${index}`}
                                labels={text}
                                locale={locale}
                              />
                            ))}
                            {message.card ? <div className="nim-chat-card">{message.card}</div> : null}
                            {message.text ? <p className="nim-chat-message__text">{message.text}</p> : null}
                          </>
                        )}
                      </div>

                      {/* Revealed on hover or keyboard focus rather than always
                          drawn: a row of controls on every bubble is what turns
                          a transcript into a toolbar. */}
                      {!message.deleted && (menu.length > 0 || onReact) ? (
                        <div className="nim-chat-message__tools">
                          {onReact ? (
                            <Menu
                              className="nim-chat-picker"
                              items={reactions.map((emoji) => ({
                                label: emoji,
                                onSelect: () => onReact(message, emoji),
                              }))}
                              label={text.react}
                            >
                              {({ ref, toggle }) => (
                                <IconButton
                                  label={text.react}
                                  name="emoji"
                                  onClick={toggle}
                                  ref={ref}
                                  size="sm"
                                />
                              )}
                            </Menu>
                          ) : null}
                          {menu.length > 0 ? (
                            <Menu items={menu} label={text.more}>
                              {({ ref, toggle }) => (
                                <IconButton
                                  label={text.more}
                                  name="more"
                                  onClick={toggle}
                                  ref={ref}
                                  size="sm"
                                />
                              )}
                            </Menu>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    {message.reactions?.length ? (
                      <Reactions labels={text} message={message} onReact={onReact} />
                    ) : null}

                    {last ? (
                      <span className="nim-chat-message__meta">
                        {message.at ? (
                          <time dateTime={message.at}>{timeFormat.format(new Date(message.at))}</time>
                        ) : null}
                        {message.edited ? <span>{text.edited}</span> : null}
                        {message.own && message.status ? (
                          <span className="nim-chat-message__status" data-status={message.status}>
                            {message.status === 'sending' ? (
                              <Spinner size="sm" />
                            ) : (
                              <Icon
                                label={text[message.status]}
                                name={message.status === 'failed' ? 'danger' : 'check-circle'}
                                size="xs"
                              />
                            )}
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </div>
                </li>
              </Fragment>
            )
          })}
        </ol>

        {typing ? (
          <p className="nim-chat__typing">
            {typeof typing === 'string' ? `${typing} ${text.typing}` : text.typing}
            <span aria-hidden="true" className="nim-chat__dots">
              <i />
              <i />
              <i />
            </span>
          </p>
        ) : null}

        {footer ? <div className="nim-chat__footer">{footer}</div> : null}
      </div>

      {composer ? <div className="nim-chat__composer">{composer}</div> : null}
    </section>
  )
}
