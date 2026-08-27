import { ReactNode } from 'react';
export type ConversationKind = 'channel' | 'direct' | 'group';
export interface Conversation {
    /** Group and direct only. A channel is a room, not a face. */
    avatar?: string;
    id: string;
    kind: ConversationKind;
    /** Someone is typing in it. Replaces the preview, because "Sara is typing"
        is newer than the last message and that is what the row is for. */
    typing?: string;
    /** Muted rooms still count their unread, they just do not shout about it:
        the badge goes quiet rather than away, or the reader loses the room. */
    muted?: boolean;
    name: string;
    /** Members, shown on groups and channels. A number, formatted by the kit. */
    members?: number;
    /** Last message, one line. Already prefixed with the speaker by the app if
        the room needs it — who said it is a product decision, not a layout one. */
    preview?: string;
    /** ISO timestamp of the last message. */
    at?: string;
    unread?: number;
}
export interface ConversationSection {
    key: string;
    label: string;
    items: Conversation[];
}
export interface ConversationListProps {
    activeId?: string;
    className?: string;
    labels?: Partial<typeof DEFAULT_LABELS>;
    locale?: string;
    onSelect?: (conversation: Conversation) => void;
    sections: ConversationSection[];
}
declare const DEFAULT_LABELS: {
    back: string;
    channels: string;
    compose: string;
    members: string;
    muted: string;
    search: string;
    unread: string;
};
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
export declare function ConversationList({ activeId, className, labels, locale, onSelect, sections, }: ConversationListProps): import("react").JSX.Element;
export interface MessengerProps {
    activeId?: string;
    /** The thread. One child, the `Chat` for whichever room is open. */
    children: ReactNode;
    className?: string;
    /** Above the list — a title, an avatar, a compose button. */
    brand?: ReactNode;
    labels?: Partial<typeof DEFAULT_LABELS>;
    locale?: string;
    onCompose?: () => void;
    onSelect?: (conversation: Conversation) => void;
    /** Leaving the open room to get back to the list. Narrow layouts only; on a
        wide one both panes are on screen and there is nothing to go back to. */
    onBack?: () => void;
    /** The search box is the caller's: what it searches — rooms, messages,
        people, all three — is a product decision with a different backend behind
        each answer. */
    search?: ReactNode;
    sections: ConversationSection[];
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
export declare function Messenger({ activeId, brand, children, className, labels, locale, onBack, onCompose, onSelect, search, sections, }: MessengerProps): import("react").JSX.Element;
export interface RoomHeaderProps {
    /** Call, search, room settings. */
    actions?: ReactNode;
    className?: string;
    kind?: ConversationKind;
    /** Members, or a presence line. One line, under the name. */
    meta?: ReactNode;
    name: string;
    avatar?: string;
    /** Facepile for a group or channel. Six is where a pile stops reading as
        people and starts reading as texture. */
    members?: {
        avatar?: string;
        name: string;
    }[];
}
/** Who the open room is, and what can be done to it. */
export declare function RoomHeader({ actions, avatar, className, kind, members, meta, name }: RoomHeaderProps): import("react").JSX.Element;
export {};
