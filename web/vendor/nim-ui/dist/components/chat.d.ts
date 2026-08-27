import { ReactNode } from 'react';
import { MenuItem } from './menu';
/** What a message carries. Text is a string; the rest is an attachment. */
export type ChatMediaKind = 'file' | 'image' | 'text' | 'video' | 'voice';
export interface ChatAttachment {
    /** Seconds. Voice and video only — a duration the viewer sees before playing. */
    duration?: number;
    kind: Exclude<ChatMediaKind, 'text'>;
    name?: string;
    /** Still frame for a video. Without one the browser draws its own first frame. */
    poster?: string;
    /** Bytes. Shown on files so nobody taps a 40MB download on mobile data. */
    size?: number;
    /** Object URL or remote URL. The kit never uploads anything itself. */
    url: string;
    /** Normalised 0–1 samples for a voice message. Absent draws a flat track. */
    waveform?: number[];
}
export interface ChatReaction {
    count: number;
    emoji: string;
    /** Whether the viewer is one of the count. It is what turns the pill into a
        toggle rather than a tally. */
    mine?: boolean;
}
export interface ChatQuote {
    author: string;
    /** The quoted message, so tapping the quote can scroll to it. */
    id: string;
    text: string;
}
export interface ChatMessage {
    attachments?: ChatAttachment[];
    /** Who wrote it. `own` messages are the viewer's and sit on the trailing edge. */
    author?: {
        avatar?: string;
        name: string;
    };
    /** A rich block inside the bubble — a chart, a map, a link preview. The kit
        renders whatever is passed and knows nothing about it, which is how a
        transcript carries a graph without the chat depending on the chart. */
    card?: ReactNode;
    /** Retracted. The bubble stays — a message that vanishes leaves the reply
        above it answering nothing — and says so instead of showing the text. */
    deleted?: boolean;
    edited?: boolean;
    id: string;
    own?: boolean;
    reactions?: ChatReaction[];
    /** What this message is a reply to, quoted above it. */
    replyTo?: ChatQuote;
    /** Delivery state, shown on own messages only — the other side's receipts
        are not the viewer's business. */
    status?: 'failed' | 'read' | 'sending' | 'sent';
    /** A notice from the room rather than a person: "Sara joined", "Pinned by
        Amir". Centred, unbubbled, never attributed to a speaker. */
    system?: boolean;
    text?: string;
    /** ISO timestamp. Formatted in the viewer's locale, never by the caller. */
    at?: string;
}
export interface ChatProps {
    /** The per-message action menu. Returning an empty list for a message hides
        its trigger, which is how a product says "not this one" — a deleted
        message, someone else's, one still sending. */
    actions?: (message: ChatMessage) => MenuItem[];
    className?: string;
    /** The composer. Passing none makes the transcript read-only, which is what
        an archive or a shared thread wants. */
    composer?: ReactNode;
    /** Rendered under the last message — a date divider, a system notice. */
    footer?: ReactNode;
    /** Header row: who this conversation is with, and its actions. */
    header?: ReactNode;
    /** Names and avatars on every run, not just where the speaker changes. Set
        it for a group or a channel; in a one-to-one it is noise, because there
        is only one other person it could be. */
    group?: boolean;
    /** Accessible names and the few words the transcript itself says. */
    labels?: Partial<typeof DEFAULT_LABELS>;
    locale?: string;
    messages: ChatMessage[];
    /** Called when a quoted reply is tapped, with the id of the message being
        quoted. Scrolling to it is the app's: only it knows whether that message
        is still in the page or has to be paged back in. */
    onJump?: (id: string) => void;
    /** Adding or removing the viewer's reaction. Unset hides the affordance. */
    onReact?: (message: ChatMessage, emoji: string) => void;
    /** The quick reactions offered on the bubble. Six is the platform norm and
        about as many as anyone scans without reading. */
    reactions?: string[];
    /** How long a pause ends a run of messages, in seconds. */
    runGap?: number;
    /** Someone is typing. A name renders "Sara is typing", bare `true` renders
        the dots alone. */
    typing?: boolean | string;
}
declare const DEFAULT_LABELS: {
    deleted: string;
    download: string;
    edited: string;
    failed: string;
    more: string;
    pause: string;
    play: string;
    react: string;
    read: string;
    reply: string;
    sending: string;
    sent: string;
    today: string;
    typing: string;
    voiceMessage: string;
    yesterday: string;
};
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
export declare function Chat({ actions, className, composer, footer, group, header, labels, locale, messages, onJump, onReact, reactions, runGap, typing, }: ChatProps): import("react").JSX.Element;
export {};
