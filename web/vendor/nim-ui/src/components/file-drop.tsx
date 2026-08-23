import { useRef, useState } from 'react'
import type { DragEvent, ReactNode } from 'react'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/cn'

export interface FileDropProps {
  accept?: string
  className?: string
  /** Shown under the prompt — "PNG or PDF, up to 10 MB". Formatting a size is
      a locale decision, so the kit takes the sentence already written. */
  caption?: ReactNode
  disabled?: boolean
  error?: string
  label: string
  multiple?: boolean
  /** Receives the picked files and nothing else. Uploading, progress and
      retries belong to the product: a component that owned the request would
      have chosen its transport, its auth and its error vocabulary too. */
  onFiles: (files: File[]) => void
  prompt?: string
}

/**
 * The dropzone IS a label wrapping a real `<input type="file">`, so clicking,
 * Enter, Space and the platform's own picker all work with no key handlers of
 * our own — and the control is announced as a file input rather than as a
 * mystery box.
 *
 * `dragenter`/`dragleave` fire for every child element the pointer crosses, so
 * the highlight is driven by a DEPTH counter; toggling a boolean is why most
 * dropzones flicker when the cursor passes over their own icon.
 */
export function FileDrop({
  accept,
  caption,
  className,
  disabled = false,
  error,
  label,
  multiple = false,
  onFiles,
  prompt,
}: FileDropProps) {
  const depth = useRef(0)
  const [over, setOver] = useState(false)

  const stop = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
  }

  return (
    <div className={cn('nim-field', error && 'nim-field--invalid', className)}>
      <label
        className="nim-file-drop"
        data-over={over || undefined}
        data-disabled={disabled || undefined}
        onDragEnter={(event) => {
          stop(event)
          depth.current += 1
          if (!disabled) setOver(true)
        }}
        onDragLeave={(event) => {
          stop(event)
          depth.current -= 1
          if (depth.current <= 0) setOver(false)
        }}
        onDragOver={stop}
        onDrop={(event) => {
          stop(event)
          depth.current = 0
          setOver(false)
          if (disabled) return
          const files = Array.from(event.dataTransfer.files)
          if (files.length > 0) onFiles(multiple ? files : files.slice(0, 1))
        }}
      >
        <input
          accept={accept}
          className="nim-choice__input"
          disabled={disabled}
          multiple={multiple}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? [])
            if (files.length > 0) onFiles(files)
            // Clearing lets the same file be picked twice in a row, which is
            // exactly what a user does after fixing it on disk.
            event.target.value = ''
          }}
          type="file"
        />
        <Icon className="nim-file-drop__icon" name="upload" size="lg" />
        <span className="nim-file-drop__label">{label}</span>
        {prompt ? <span className="nim-file-drop__prompt">{prompt}</span> : null}
        {caption ? <span className="nim-file-drop__caption">{caption}</span> : null}
      </label>
      {error ? <p className="nim-field__error">{error}</p> : null}
    </div>
  )
}
