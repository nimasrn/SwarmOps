import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '@/components/icon'
import { IconButton } from '@/components/icon-button'
import { cn } from '@/lib/cn'

export interface MediaPlayerProps {
  className?: string
  /** Start playing on mount. Browsers only honour this while muted, which is
      the whole reason a caller has to ask for both. */
  autoPlay?: boolean
  kind?: 'audio' | 'video'
  labels?: Partial<typeof DEFAULT_LABELS>
  /** Raised when the source will not load, so a caller holding more than one
      URL for the same media can fall back to the next one. */
  onError?: () => void
  locale?: string
  /** Still frame for a video, and artwork for audio. */
  poster?: string
  /** Speeds offered. One entry hides the control. */
  rates?: number[]
  src: string
  /** Shown over the transport — a track name, an episode title. */
  title?: string
  /** Normalised 0–1 samples. Audio only: with them the scrubber is a waveform,
      without them it is a rail. Neither is more accurate; the waveform just
      tells you where the silence is. */
  waveform?: number[]
}

const DEFAULT_LABELS = {
  fullscreen: 'Full screen',
  mute: 'Mute',
  pause: 'Pause',
  play: 'Play',
  rate: 'Playback speed',
  seek: 'Seek',
  unmute: 'Unmute',
  volume: 'Volume',
}

/** `4:07`, or `1:02:30` once there is an hour to say. */
function clock(seconds: number, locale: string | undefined): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  const pad = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, useGrouping: false })
  const plain = new Intl.NumberFormat(locale)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const rest = total % 60
  return hours > 0
    ? `${plain.format(hours)}:${pad.format(minutes)}:${pad.format(rest)}`
    : `${plain.format(minutes)}:${pad.format(rest)}`
}

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
export function MediaPlayer({
  autoPlay = false,
  className,
  kind = 'audio',
  labels,
  locale,
  onError,
  poster,
  rates = [1, 1.5, 2],
  src,
  title,
  waveform,
}: MediaPlayerProps) {
  const text = { ...DEFAULT_LABELS, ...labels }
  const media = useRef<HTMLMediaElement | null>(null)
  const frame = useRef<HTMLDivElement>(null)

  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [muted, setMuted] = useState(autoPlay)
  const [volume, setVolume] = useState(1)
  const [rate, setRate] = useState(1)

  const progress = duration > 0 ? position / duration : 0
  const bars = useMemo(() => waveform ?? null, [waveform])

  const toggle = useCallback(() => {
    const element = media.current
    if (!element) return
    if (element.paused) void element.play()
    else element.pause()
  }, [])

  useEffect(() => {
    const element = media.current
    if (element) element.playbackRate = rate
  }, [rate])

  const onProgress = (element: HTMLMediaElement) => {
    const ranges = element.buffered
    setBuffered(ranges.length ? ranges.end(ranges.length - 1) : 0)
  }

  const shared = {
    onDurationChange: (event: { currentTarget: HTMLMediaElement }) =>
      setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0),
    onEnded: () => setPlaying(false),
    onPause: () => setPlaying(false),
    onPlay: () => setPlaying(true),
    onProgress: (event: { currentTarget: HTMLMediaElement }) => onProgress(event.currentTarget),
    onTimeUpdate: (event: { currentTarget: HTMLMediaElement }) =>
      setPosition(event.currentTarget.currentTime),
    onVolumeChange: (event: { currentTarget: HTMLMediaElement }) => {
      setMuted(event.currentTarget.muted)
      setVolume(event.currentTarget.volume)
    },
    onError,
  }

  return (
    <div
      className={cn('nim-player', className)}
      data-kind={kind}
      data-playing={playing ? 'true' : undefined}
      ref={frame}
    >
      {kind === 'video' ? (
        <div className="nim-player__stage">
          <video
            autoPlay={autoPlay}
            className="nim-player__video"
            muted={autoPlay}
            playsInline
            poster={poster}
            preload="metadata"
            ref={(node) => {
              media.current = node
            }}
            src={src}
            {...shared}
          />
          {/* One big target over the picture. Tapping the video to play or
              pause is the gesture every player on every platform has. */}
          <button
            aria-label={playing ? text.pause : text.play}
            className="nim-player__surface"
            onClick={toggle}
            type="button"
          >
            {!playing ? (
              <span className="nim-player__badge">
                <Icon name="play" size="lg" />
              </span>
            ) : null}
          </button>
        </div>
      ) : (
        <audio
          autoPlay={autoPlay}
          preload="metadata"
          ref={(node) => {
            media.current = node
          }}
          src={src}
          {...shared}
        />
      )}

      <div className="nim-player__transport">
        <IconButton
          label={playing ? text.pause : text.play}
          name={playing ? 'pause' : 'play'}
          onClick={toggle}
          size="md"
          variant="solid"
        />

        <div className="nim-player__track">
          {title ? <span className="nim-player__title">{title}</span> : null}

          <div className="nim-player__rail" data-wave={bars ? 'true' : undefined}>
            {bars ? (
              <span aria-hidden="true" className="nim-player__wave">
                {bars.map((bar, index) => (
                  <i
                    data-played={index / bars.length <= progress ? 'true' : undefined}
                    key={index}
                    style={{ blockSize: `${Math.max(8, Math.round(bar * 100))}%` }}
                  />
                ))}
              </span>
            ) : (
              <>
                {/* Buffered under played: how much is safe to scrub into is a
                    different question from how far you have got. */}
                <span aria-hidden="true" className="nim-player__buffer" style={{ inlineSize: `${duration ? (buffered / duration) * 100 : 0}%` }} />
                <span aria-hidden="true" className="nim-player__played" style={{ inlineSize: `${progress * 100}%` }} />
              </>
            )}
            <input
              aria-label={text.seek}
              aria-valuetext={`${clock(position, locale)} / ${clock(duration, locale)}`}
              className="nim-player__seek"
              max={duration || 0}
              min={0}
              onChange={(event) => {
                const next = Number(event.target.value)
                setPosition(next)
                if (media.current) media.current.currentTime = next
              }}
              step="any"
              type="range"
              value={position}
            />
          </div>

          <span className="nim-player__times">
            <time>{clock(position, locale)}</time>
            <time>{clock(duration, locale)}</time>
          </span>
        </div>

        <div className="nim-player__side">
          {rates.length > 1 ? (
            <button
              aria-label={text.rate}
              className="nim-player__rate"
              onClick={() => setRate(rates[(rates.indexOf(rate) + 1) % rates.length] ?? 1)}
              type="button"
            >
              {new Intl.NumberFormat(locale).format(rate)}×
            </button>
          ) : null}

          <IconButton
            label={muted ? text.unmute : text.mute}
            name={muted || volume === 0 ? 'volume-off' : 'volume'}
            onClick={() => {
              const element = media.current
              if (element) element.muted = !element.muted
            }}
            size="sm"
          />
          <input
            aria-label={text.volume}
            className="nim-player__volume"
            max={1}
            min={0}
            onChange={(event) => {
              const element = media.current
              if (!element) return
              element.volume = Number(event.target.value)
              element.muted = Number(event.target.value) === 0
            }}
            step={0.05}
            type="range"
            value={muted ? 0 : volume}
          />

          {kind === 'video' ? (
            <IconButton
              label={text.fullscreen}
              name="expand"
              onClick={() => {
                if (document.fullscreenElement) void document.exitFullscreen()
                else void frame.current?.requestFullscreen?.()
              }}
              size="sm"
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
