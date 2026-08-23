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
    placeholder?: string;
    /** Turn off what the product does not support. Voice also switches itself
        off where the browser has no recorder. */
    allow?: {
        file?: boolean;
        video?: boolean;
        voice?: boolean;
    };
}
declare const DEFAULT_LABELS: {
    attach: string;
    cancel: string;
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
export declare function ChatComposer({ accept, allow, className, disabled, labels, onFiles, onSend, placeholder, }: ChatComposerProps): import("react").JSX.Element;
export {};
