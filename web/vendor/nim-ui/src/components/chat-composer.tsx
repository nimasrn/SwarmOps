import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/icon'
import { IconButton } from '@/components/icon-button'
import { cn } from '@/lib/cn'
import type { ChatAttachment } from '@/components/chat'

export interface ChatDraft {
  attachments: ChatAttachment[]
  text: string
}

export interface ChatComposerProps {
  /** Accept list for the attach button. Narrow it to what the product takes. */
  accept?: string
  className?: string
  disabled?: boolean
  labels?: Partial<typeof DEFAULT_LABELS>
  /** Called with the draft. Uploading is the app's: the attachments carry
      object URLs and their `File`s are handed over in `onFiles`. */
  onSend: (draft: ChatDraft) => void
  /** The raw `File`s behind the attachments in the same order, so the caller
      can upload them without re-reading the object URLs. */
  onFiles?: (files: File[]) => void
  /** Called when the viewer edits the draft. Delivery, throttling and presence
      policy belong to the product rather than the component. */
  onTyping?: () => void
  placeholder?: string
  /** Turn off what the product does not support. Voice also switches itself
      off where the browser has no recorder. */
  allow?: { file?: boolean; video?: boolean; voice?: boolean }
  /** The message being answered, quoted above the input. The composer only
      SHOWS it — carrying the id onto the sent message is the app's, because
      the app is what owns the message it is about to create. */
  replyTo?: { author: string; text: string }
  /** Dismissing the quote. Without it the reply bar has no exit, which is the
      one thing a reply bar must always have. */
  onCancelReply?: () => void
}

const DEFAULT_LABELS = {
  attach: 'Attach a file',
  cancel: 'Cancel recording',
  cancelReply: 'Cancel reply',
  replyingTo: 'Replying to',
  discard: 'Remove attachment',
  record: 'Record a voice message',
  recording: 'Recording',
  send: 'Send',
  stop: 'Stop and attach',
  video: 'Attach a video',
}

/** Recording is a permissioned browser capability, not something to assume. */
const canRecord = () =>
  typeof navigator !== 'undefined' &&
  typeof window !== 'undefined' &&
  'MediaRecorder' in window &&
  Boolean(navigator.mediaDevices?.getUserMedia)

const kindOf = (file: File): ChatAttachment['kind'] =>
  file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : 'file'

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
export function ChatComposer({
  accept,
  allow,
  className,
  disabled = false,
  labels,
  onCancelReply,
  onFiles,
  onSend,
  onTyping,
  placeholder,
  replyTo,
}: ChatComposerProps) {
  const text = { ...DEFAULT_LABELS, ...labels }
  const permit = { file: true, video: true, voice: true, ...allow }

  const [draft, setDraft] = useState('')
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [recordable] = useState(canRecord)

  const files = useRef<File[]>([])
  const filePicker = useRef<HTMLInputElement>(null)
  const videoPicker = useRef<HTMLInputElement>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  // The duration is measured at stop rather than read off the ticking state:
  // the recorder's own callback closes over whatever `elapsed` was when
  // recording started, which is always zero.
  const startedAt = useRef(0)
  const chunks = useRef<Blob[]>([])
  const textarea = useRef<HTMLTextAreaElement>(null)

  const stopStream = useCallback(() => {
    recorder.current?.stream.getTracks().forEach((track) => track.stop())
    recorder.current = null
  }, [])

  useEffect(() => stopStream, [stopStream])

  useEffect(() => {
    if (replyTo) textarea.current?.focus()
  }, [replyTo])

  useEffect(() => {
    if (!recording) return
    const timer = window.setInterval(() => setElapsed((Date.now() - startedAt.current) / 1000), 200)
    return () => window.clearInterval(timer)
  }, [recording])

  const addFiles = useCallback(
    (picked: FileList | null) => {
      if (!picked?.length) return
      const list = Array.from(picked)
      files.current = [...files.current, ...list]
      setAttachments((was) => [
        ...was,
        ...list.map((file) => ({
          kind: kindOf(file),
          name: file.name,
          size: file.size,
          url: URL.createObjectURL(file),
        })),
      ])
    },
    [],
  )

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const media = new MediaRecorder(stream)
      chunks.current = []
      media.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data)
      }
      media.onstop = () => {
        const blob = new Blob(chunks.current, { type: media.mimeType })
        const file = new File([blob], 'voice-message', { type: media.mimeType })
        files.current = [...files.current, file]
        setAttachments((was) => [
          ...was,
          {
            duration: (Date.now() - startedAt.current) / 1000,
            kind: 'voice',
            size: blob.size,
            url: URL.createObjectURL(blob),
          },
        ])
        stopStream()
      }
      recorder.current = media
      media.start()
      startedAt.current = Date.now()
      setElapsed(0)
      setRecording(true)
    } catch {
      // A denied microphone is an answer, not an error to shout about: the
      // viewer said no, and the rest of the composer still works.
      setRecording(false)
      stopStream()
    }
  }, [stopStream])

  const finishRecording = useCallback(
    (keep: boolean) => {
      const media = recorder.current
      setRecording(false)
      if (!media) return
      if (!keep) media.onstop = stopStream
      media.stop()
    },
    [stopStream],
  )

  const removeAttachment = (index: number) => {
    setAttachments((was) => {
      URL.revokeObjectURL(was[index].url)
      return was.filter((_, position) => position !== index)
    })
    files.current = files.current.filter((_, position) => position !== index)
  }

  const send = () => {
    if (!draft.trim() && attachments.length === 0) return
    onSend({ attachments, text: draft.trim() })
    onFiles?.(files.current)
    files.current = []
    setAttachments([])
    setDraft('')
    textarea.current?.focus()
  }

  const empty = !draft.trim() && attachments.length === 0

  return (
    <div className={cn('nim-composer', className)}>
      {replyTo ? (
        <div className="nim-composer__reply">
          <Icon className="nim-composer__reply-mark" name="reply" size="sm" />
          <span className="nim-composer__reply-text">
            <span className="nim-composer__reply-author">
              {text.replyingTo} {replyTo.author}
            </span>
            <span className="nim-composer__reply-quote">{replyTo.text}</span>
          </span>
          <IconButton label={text.cancelReply} name="close" onClick={onCancelReply} size="sm" />
        </div>
      ) : null}

      {attachments.length ? (
        <ul className="nim-composer__tray">
          {attachments.map((attachment, index) => (
            <li className="nim-composer__chip" key={attachment.url}>
              <Icon
                name={
                  attachment.kind === 'voice'
                    ? 'mic'
                    : attachment.kind === 'video'
                      ? 'video'
                      : attachment.kind === 'image'
                        ? 'camera'
                        : 'document'
                }
                size="xs"
              />
              <span className="nim-composer__chip-name">{attachment.name ?? text.record}</span>
              <IconButton
                label={text.discard}
                name="close"
                onClick={() => removeAttachment(index)}
                size="sm"
              />
            </li>
          ))}
        </ul>
      ) : null}

      <div className="nim-composer__row">
        {recording ? (
          <div className="nim-composer__recording" role="status">
            <span aria-hidden="true" className="nim-composer__pulse" />
            <span className="nim-composer__recording-label">{text.recording}</span>
            <span className="nim-composer__elapsed">{elapsed.toFixed(1)}s</span>
            <IconButton
              label={text.cancel}
              name="close"
              onClick={() => finishRecording(false)}
              size="sm"
            />
            <IconButton
              label={text.stop}
              name="stop"
              onClick={() => finishRecording(true)}
              size="sm"
              variant="solid"
            />
          </div>
        ) : (
          <>
            {permit.file ? (
              <IconButton
                disabled={disabled}
                label={text.attach}
                name="paperclip"
                onClick={() => filePicker.current?.click()}
                size="sm"
              />
            ) : null}
            {permit.video ? (
              <IconButton
                disabled={disabled}
                label={text.video}
                name="video"
                onClick={() => videoPicker.current?.click()}
                size="sm"
              />
            ) : null}

            <textarea
              className="nim-composer__input"
              disabled={disabled}
              onChange={(event) => {
                setDraft(event.target.value)
                onTyping?.()
              }}
              onKeyDown={(event) => {
                // Enter sends, Shift+Enter breaks the line. The other way round
                // costs a keystroke on every message anyone ever sends.
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  send()
                }
              }}
              placeholder={placeholder}
              ref={textarea}
              rows={1}
              value={draft}
            />

            {permit.voice && recordable && empty ? (
              <IconButton
                disabled={disabled}
                label={text.record}
                name="mic"
                onClick={() => void startRecording()}
                size="sm"
              />
            ) : (
              <IconButton
                disabled={disabled || empty}
                label={text.send}
                name="send"
                onClick={send}
                size="sm"
                variant="solid"
              />
            )}
          </>
        )}
      </div>

      {/* Hidden pickers rather than styled inputs: the file dialog is the
          platform's, and nothing about it is worth reimplementing. */}
      <input
        accept={accept}
        className="nim-visually-hidden"
        multiple
        onChange={(event) => {
          addFiles(event.target.files)
          event.target.value = ''
        }}
        ref={filePicker}
        tabIndex={-1}
        type="file"
      />
      <input
        accept="video/*"
        className="nim-visually-hidden"
        onChange={(event) => {
          addFiles(event.target.files)
          event.target.value = ''
        }}
        ref={videoPicker}
        tabIndex={-1}
        type="file"
      />
    </div>
  )
}
