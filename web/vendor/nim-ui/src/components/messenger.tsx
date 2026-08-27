import type { ReactNode } from 'react'
import { Avatar } from '@/components/avatar'
import { Badge } from '@/components/badge'
import { Icon } from '@/components/icon'
import { IconButton } from '@/components/icon-button'
import { cn } from '@/lib/cn'

export type ConversationKind = 'channel' | 'direct' | 'group'

export interface Conversation {
  /** Group and direct only. A channel is a room, not a face. */
  avatar?: string
  id: string
  kind: ConversationKind
  /** Someone is typing in it. Replaces the preview, because "Sara is typing"
      is newer than the last message and that is what the row is for. */
  typing?: string
  /** Muted rooms still count their unread, they just do not shout about it:
      the badge goes quiet rather than away, or the reader loses the room. */
  muted?: boolean
  name: string
  /** Members, shown on groups and channels. A number, formatted by the kit. */
  members?: number
  /** Last message, one line. Already prefixed with the speaker by the app if
      the room needs it — who said it is a product decision, not a layout one. */
  preview?: string
  /** ISO timestamp of the last message. */
  at?: string
  unread?: number
}

export interface ConversationSection {
  key: string
  label: string
  items: Conversation[]
}

export interface ConversationListProps {
  activeId?: string
  className?: string
  labels?: Partial<typeof DEFAULT_LABELS>
  locale?: string
  onSelect?: (conversation: Conversation) => void
  sections: ConversationSection[]
}

const DEFAULT_LABELS = {
  back: 'Back to conversations',
  channels: 'Conversations',
  compose: 'New conversation',
  members: 'members',
  muted: 'Muted',
  search: 'Search conversations',
  unread: 'unread',
}

const GLYPH: Record<ConversationKind, 'hash' | 'user' | 'users'> = {
  channel: 'hash',
  direct: 'user',
  group: 'users',
}

/** `14:32` today, `Tue` this week, `4 Mar` before that — the resolution a
    reader actually needs to place a message drops off with its age. */
function stamp(iso: string, locale: string | undefined): string {
  const then = new Date(iso)
  const now = new Date()
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  if (then.getTime() >= midnight) {
    return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(then)
  }
  if (then.getTime() >= midnight - 6 * 86_400_000) {
    return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(then)
  }
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(then)
}

/**
 * The rooms, in sections: channels, groups, direct.
 *
 * A channel gets a `#`, a group gets a stack of faces, a person gets theirs —
 * the glyph is the only thing that tells the three apart at a glance, and it
 * has to be in the same place on every row for that to work.
 *
 * Unread is a count on the row, not a dot on the app: a reader deciding which
 * room to open next needs to know how much is waiting in each, and a room with
 * two messages is a different decision from one with two hundred.
 */
export function ConversationList({
  activeId,
  className,
  labels,
  locale,
  onSelect,
  sections,
}: ConversationListProps) {
  const text = { ...DEFAULT_LABELS, ...labels }
  const count = new Intl.NumberFormat(locale)

  return (
    <div className={cn('nim-rooms', className)}>
      {sections.map((section) => (
        <section className="nim-rooms__section" key={section.key}>
          <p className="nim-rooms__label">{section.label}</p>
          <ul className="nim-rooms__list">
            {section.items.map((room) => (
              <li key={room.id}>
                <button
                  aria-current={room.id === activeId ? 'true' : undefined}
                  className="nim-room"
                  data-unread={room.unread ? 'true' : undefined}
                  onClick={() => onSelect?.(room)}
                  type="button"
                >
                  <span className="nim-room__face">
                    {room.kind === 'channel' ? (
                      <span className="nim-room__glyph">
                        <Icon name="hash" size="sm" />
                      </span>
                    ) : (
                      <Avatar name={room.name} size="sm" src={room.avatar} />
                    )}
                  </span>

                  <span className="nim-room__body">
                    <span className="nim-room__top">
                      <span className="nim-room__name">
                        {room.name}
                        {room.muted ? (
                          <Icon className="nim-room__mute" label={text.muted} name="volume-off" size="xs" />
                        ) : null}
                      </span>
                      {room.at ? <span className="nim-room__at">{stamp(room.at, locale)}</span> : null}
                    </span>

                    <span className="nim-room__bottom">
                      <span className="nim-room__preview" data-typing={room.typing ? 'true' : undefined}>
                        {room.typing ?? room.preview}
                      </span>
                      {room.unread ? (
                        <Badge size="sm" tone="solid" variant={room.muted ? 'neutral' : 'accent'}>
                          {count.format(room.unread)}
                          <span className="nim-visually-hidden"> {text.unread}</span>
                        </Badge>
                      ) : room.members ? (
                        <span className="nim-room__members">
                          <Icon name={GLYPH[room.kind]} size="xs" />
                          {count.format(room.members)}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

export interface MessengerProps {
  activeId?: string
  /** The thread. One child, the `Chat` for whichever room is open. */
  children: ReactNode
  className?: string
  /** Above the list — a title, an avatar, a compose button. */
  brand?: ReactNode
  labels?: Partial<typeof DEFAULT_LABELS>
  locale?: string
  onCompose?: () => void
  onSelect?: (conversation: Conversation) => void
  /** Leaving the open room to get back to the list. Narrow layouts only; on a
      wide one both panes are on screen and there is nothing to go back to. */
  onBack?: () => void
  /** The search box is the caller's: what it searches — rooms, messages,
      people, all three — is a product decision with a different backend behind
      each answer. */
  search?: ReactNode
  sections: ConversationSection[]
}

/**
 * Two panes: the rooms and the open one.
 *
 * The responsive switch is a CONTAINER query, not a media query. A messenger is
 * very often embedded — in a support console, in a side panel — and one that
 * answers the window instead of its own box is wrong in exactly the case it is
 * embedded in.
 *
 * Narrow, the two panes become one: the list until a room is chosen, then the
 * room with a way back. That is a state the CALLER owns through `activeId`,
 * because it is the same state that decides which transcript to fetch.
 */
export function Messenger({
  activeId,
  brand,
  children,
  className,
  labels,
  locale,
  onBack,
  onCompose,
  onSelect,
  search,
  sections,
}: MessengerProps) {
  const text = { ...DEFAULT_LABELS, ...labels }

  return (
    <div className={cn('nim-messenger', className)} data-open={activeId ? 'true' : undefined}>
      <aside aria-label={text.channels} className="nim-messenger__rail">
        <div className="nim-messenger__rail-head">
          {brand}
          {onCompose ? (
            <IconButton label={text.compose} name="plus" onClick={onCompose} size="sm" variant="outline" />
          ) : null}
        </div>
        {search ? <div className="nim-messenger__search">{search}</div> : null}
        <div className="nim-messenger__rail-scroll">
          <ConversationList
            activeId={activeId}
            labels={labels}
            locale={locale}
            onSelect={onSelect}
            sections={sections}
          />
        </div>
      </aside>

      <div className="nim-messenger__thread">
        {onBack ? (
          <IconButton
            className="nim-messenger__back"
            label={text.back}
            name="chevron-back"
            onClick={onBack}
            size="sm"
          />
        ) : null}
        {children}
      </div>
    </div>
  )
}

export interface RoomHeaderProps {
  /** Call, search, room settings. */
  actions?: ReactNode
  className?: string
  kind?: ConversationKind
  /** Members, or a presence line. One line, under the name. */
  meta?: ReactNode
  name: string
  avatar?: string
  /** Facepile for a group or channel. Six is where a pile stops reading as
      people and starts reading as texture. */
  members?: { avatar?: string; name: string }[]
}

/** Who the open room is, and what can be done to it. */
export function RoomHeader({ actions, avatar, className, kind = 'direct', members, meta, name }: RoomHeaderProps) {
  return (
    <div className={cn('nim-room-head', className)}>
      {kind === 'channel' ? (
        <span className="nim-room__glyph">
          <Icon name="hash" size="sm" />
        </span>
      ) : (
        <Avatar name={name} size="md" src={avatar} />
      )}

      <div className="nim-room-head__text">
        <span className="nim-room-head__name">{name}</span>
        {meta ? <span className="nim-room-head__meta">{meta}</span> : null}
      </div>

      {members?.length ? (
        <ul className="nim-facepile">
          {members.slice(0, 6).map((member) => (
            <li key={member.name}>
              <Avatar name={member.name} size="sm" src={member.avatar} />
            </li>
          ))}
        </ul>
      ) : null}

      {actions ? <div className="nim-room-head__actions">{actions}</div> : null}
    </div>
  )
}
