import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Avatar } from '@/components/avatar'
import { Icon } from '@/components/icon'
import { IconButton } from '@/components/icon-button'
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

export interface ChatMessage {
  attachments?: ChatAttachment[]
  /** Who wrote it. `own` messages are the viewer's and sit on the trailing edge. */
  author?: { avatar?: string; name: string }
  id: string
  own?: boolean
  /** Delivery state, shown on own messages only — the other side's receipts
      are not the viewer's business. */
  status?: 'failed' | 'read' | 'sending' | 'sent'
  text?: string
  /** ISO timestamp. Formatted in the viewer's locale, never by the caller. */
  at?: string
}

export interface ChatProps {
  className?: string
  /** Someone is typing. A name renders "Sara is typing", bare `true` renders
      the dots alone. */
  typing?: boolean | string
  /** Rendered under the last message — a date divider, a system notice. */
  footer?: ReactNode
  /** Accessible names and the few words the transcript itself says. */
  labels?: Partial<typeof DEFAULT_LABELS>
  /** The composer. Passing none makes the transcript read-only, which is what
      an archive or a shared thread wants. */
  composer?: ReactNode
  locale?: string
  messages: ChatMessage[]
  /** Header row: who this conversation is with, and its actions. */
  header?: ReactNode
}

const DEFAULT_LABELS = {
  download: 'Download',
  failed: 'Not delivered',
  pause: 'Pause',
  play: 'Play',
  read: 'Read',
  sending: 'Sending',
  sent: 'Sent',
  today: 'Today',
  typing: 'is typing',
  yesterday: 'Yesterday',
  voiceMessage: 'Voice message',
}

const KB = 1024

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

/**
 * One conversation: a scrolling transcript with a composer under it.
 *
 * The transcript is a `<ol>` in a live region, so a message arriving is
 * announced without stealing focus from whatever the viewer is typing. It
 * follows the newest message only when the viewer is already at the bottom —
 * yanking someone back down while they are reading history is the single most
 * common chat bug, and it is a scroll check, not a scroll call.
 *
 * Media is played by the platform's own elements. The kit renders transports
 * and bubbles; it never uploads, transcodes, or holds a socket.
 */
export function Chat({
  className,
  composer,
  footer,
  header,
  labels,
  locale,
  messages,
  typing,
}: ChatProps) {
  const text = { ...DEFAULT_LABELS, ...labels }
  const scroller = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)

  const timeFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }),
    [locale],
  )

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
          {messages.map((message) => (
            <li
              className={cn('nim-chat-message', message.own && 'nim-chat-message--own')}
              key={message.id}
            >
              {!message.own && message.author ? (
                <Avatar
                  className="nim-chat-message__avatar"
                  name={message.author.name}
                  size="sm"
                  src={message.author.avatar}
                />
              ) : null}

              <div className="nim-chat-message__stack">
                {!message.own && message.author ? (
                  <span className="nim-chat-message__author">{message.author.name}</span>
                ) : null}

                <div className="nim-chat-message__bubble">
                  {message.attachments?.map((attachment, index) => (
                    <AttachmentView
                      attachment={attachment}
                      key={`${message.id}-${index}`}
                      labels={text}
                      locale={locale}
                    />
                  ))}
                  {message.text ? <p className="nim-chat-message__text">{message.text}</p> : null}
                </div>

                <span className="nim-chat-message__meta">
                  {message.at ? (
                    <time dateTime={message.at}>{timeFormat.format(new Date(message.at))}</time>
                  ) : null}
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
              </div>
            </li>
          ))}
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
