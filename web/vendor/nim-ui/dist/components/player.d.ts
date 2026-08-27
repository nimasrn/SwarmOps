export interface MediaPlayerProps {
    className?: string;
    /** Start playing on mount. Browsers only honour this while muted, which is
        the whole reason a caller has to ask for both. */
    autoPlay?: boolean;
    kind?: 'audio' | 'video';
    labels?: Partial<typeof DEFAULT_LABELS>;
    /** Raised when the source will not load, so a caller holding more than one
        URL for the same media can fall back to the next one. */
    onError?: () => void;
    locale?: string;
    /** Still frame for a video, and artwork for audio. */
    poster?: string;
    /** Speeds offered. One entry hides the control. */
    rates?: number[];
    src: string;
    /** Shown over the transport — a track name, an episode title. */
    title?: string;
    /** Normalised 0–1 samples. Audio only: with them the scrubber is a waveform,
        without them it is a rail. Neither is more accurate; the waveform just
        tells you where the silence is. */
    waveform?: number[];
}
declare const DEFAULT_LABELS: {
    fullscreen: string;
    mute: string;
    pause: string;
    play: string;
    rate: string;
    seek: string;
    unmute: string;
    volume: string;
};
/**
 * A player built ON the platform's `<audio>` / `<video>`, not instead of it.
 *
 * The element is real and keeps everything only it can give: the decoder, the
 * OS media keys and lock-screen artwork, picture-in-picture, AirPlay, captions,
 * and playback that survives the tab going to the background. What is drawn
 * here is the transport — the part a product wants to look like its own.
 *
 * The scrubber is a real `<input type="range">`. Dragging a div is how a player
 * loses its keyboard: Home, End, arrows and page keys are all free on a range,
 * and every one of them has to be rebuilt by hand otherwise.
 *
 * Video keeps `controls` off only because the transport below replaces them
 * one for one. Full screen is requested on the FRAME, not the element, so the
 * transport goes full screen with the picture instead of vanishing behind the
 * browser's own.
 */
export declare function MediaPlayer({ autoPlay, className, kind, labels, locale, onError, poster, rates, src, title, waveform, }: MediaPlayerProps): import("react").JSX.Element;
export {};
