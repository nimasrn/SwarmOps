import { ChatAttachment } from './chat';
export interface ChatDraft {
    attachments: ChatAttachment[];
    text: string;
}
export interface ChatComposerProps {
    /** Accept list for the attach button. Narrow it to what the product takes. */
    accept?: string;
    className?: string;
    disabled?: boolean;
    labels?: Partial<typeof DEFAULT_LABELS>;
    /** Called with the draft. Uploading is the app's: the attachments carry
        object URLs and their `File`s are handed over in `onFiles`. */
    onSend: (draft: ChatDraft) => void;
    /** The raw `File`s behind the attachments in the same order, so the caller
        can upload them without re-reading the object URLs. */
    onFiles?: (files: File[]) => void;
    /** Called when the viewer edits the draft. Delivery, throttling and presence
        policy belong to the product rather than the component. */
    onTyping?: () => void;
    placeholder?: string;
    /** Turn off what the product does not support. Voice also switches itself
        off where the browser has no recorder. */
    allow?: {
        file?: boolean;
        video?: boolean;
        voice?: boolean;
    };
    /** The message being answered, quoted above the input. The composer only
        SHOWS it — carrying the id onto the sent message is the app's, because
        the app is what owns the message it is about to create. */
    replyTo?: {
        author: string;
        text: string;
    };
    /** Dismissing the quote. Without it the reply bar has no exit, which is the
        one thing a reply bar must always have. */
    onCancelReply?: () => void;
}
declare const DEFAULT_LABELS: {
    attach: string;
    cancel: string;
    cancelReply: string;
    replyingTo: string;
    discard: string;
    record: string;
    recording: string;
    send: string;
    stop: string;
    video: string;
};
/**
 * The composer: text, a file, a video, or a voice message recorded in place.
 *
 * It holds the draft and nothing else — no transport, no upload, no socket.
 * `onSend` receives the text and the attachments, and `onFiles` hands over the
 * original `File`s, because an object URL is for showing and a `File` is for
 * uploading and the caller needs both.
 *
 * Voice recording is `MediaRecorder` over `getUserMedia`. Where either is
 * missing — an old browser, an insecure origin, a denied microphone — the
 * button is simply not rendered, rather than offered and then failing. The
 * stream's tracks are stopped on every exit path, including unmount: a
 * recorder left running is a microphone indicator that never goes away.
 */
export declare function ChatComposer({ accept, allow, className, disabled, labels, onCancelReply, onFiles, onSend, onTyping, placeholder, replyTo, }: ChatComposerProps): import("react").JSX.Element;
export {};
