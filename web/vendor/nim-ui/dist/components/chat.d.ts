import { ReactNode } from 'react';
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
export interface ChatMessage {
    attachments?: ChatAttachment[];
    /** Who wrote it. `own` messages are the viewer's and sit on the trailing edge. */
    author?: {
        avatar?: string;
        name: string;
    };
    id: string;
    own?: boolean;
    /** Delivery state, shown on own messages only — the other side's receipts
        are not the viewer's business. */
    status?: 'failed' | 'read' | 'sending' | 'sent';
    text?: string;
    /** ISO timestamp. Formatted in the viewer's locale, never by the caller. */
    at?: string;
}
export interface ChatProps {
    className?: string;
    /** Someone is typing. A name renders "Sara is typing", bare `true` renders
        the dots alone. */
    typing?: boolean | string;
    /** Rendered under the last message — a date divider, a system notice. */
    footer?: ReactNode;
    /** Accessible names and the few words the transcript itself says. */
    labels?: Partial<typeof DEFAULT_LABELS>;
    /** The composer. Passing none makes the transcript read-only, which is what
        an archive or a shared thread wants. */
    composer?: ReactNode;
    locale?: string;
    messages: ChatMessage[];
    /** Header row: who this conversation is with, and its actions. */
    header?: ReactNode;
}
declare const DEFAULT_LABELS: {
    download: string;
    failed: string;
    pause: string;
    play: string;
    read: string;
    sending: string;
    sent: string;
    today: string;
    typing: string;
    yesterday: string;
    voiceMessage: string;
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
 * Media is played by the platform's own elements. The kit renders transports
 * and bubbles; it never uploads, transcodes, or holds a socket.
 */
export declare function Chat({ className, composer, footer, header, labels, locale, messages, typing, }: ChatProps): import("react").JSX.Element;
export {};
