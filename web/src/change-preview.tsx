import { useState } from 'react'
import {
  Banner,
  Body,
  Button,
  Caveat,
  Input,
  Label,
  Mono,
  Panel,
  Rows,
} from '@nim.zone/ui'
import { api } from './api'
import type { ChangePreview as Preview, PreviewConsequence } from './types'

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Could not compute the preview'
}

/** A consequence card. `good` earns the accent; everything else stays quiet so
 *  the one figure that should reassure is the one that does. */
function Consequence({ item }: { item: PreviewConsequence }) {
  return (
    <div className="swarmops-preview__cell" data-tone={item.tone ?? 'neutral'}>
      <Label as="p">{item.label}</Label>
      <p className="swarmops-preview__value">{item.value}</p>
      {item.note ? <Body size="sm">{item.note}</Body> : null}
    </div>
  )
}

export function ChangePreviewPanel({ serviceID, currentImage }: { serviceID: string; currentImage?: string }) {
  const [image, setImage] = useState(currentImage ?? '')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    setError('')
    try {
      setPreview(await api.changePreview(serviceID, image))
    } catch (reason) {
      setError(messageOf(reason))
      setPreview(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel
      description="Computed against the live cluster, not against the file. Nothing is queued — this is what would happen, so you can decide it should not."
      title="What a deploy would do"
    >
      <Rows>
        <Input
          hint="The image tag to roll out."
          label="New image"
          onChange={(event) => setImage(event.target.value)}
          value={image}
        />
        <div>
          <Button disabled={image.trim() === '' || image === currentImage} loading={busy} onClick={() => void run()} variant="secondary">
            Preview this change
          </Button>
        </div>
        {error ? <Banner tone="danger">{error}</Banner> : null}

        {preview ? (
          <>
            <div className="swarmops-preview__grid">
              {preview.consequences.map((item) => <Consequence item={item} key={item.label} />)}
            </div>

            <div>
              <Label as="p">The sequence, in the order Swarm will perform it</Label>
              <ol className="swarmops-preview__steps">
                {preview.steps.map((step, index) => (
                  <li key={`${step.title}-${index}`}>
                    <span className="swarmops-preview__step-title">{step.title}</span>
                    {step.detail ? <span className="swarmops-preview__step-detail">{step.detail}</span> : null}
                    {step.mark ? <Mono>{step.mark}</Mono> : null}
                  </li>
                ))}
              </ol>
            </div>

            <Banner title="If a step fails" tone="neutral">{preview.rollback}</Banner>

            <Caveat title="What this preview cannot promise">
              {preview.unknowns.map((line) => <p key={line}>{line}</p>)}
            </Caveat>
          </>
        ) : null}
      </Rows>
    </Panel>
  )
}
