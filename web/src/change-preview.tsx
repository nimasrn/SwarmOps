import { useState } from 'react'
import {
  Banner,
  Button,
  Caveat,
  DecideBar,
  Diff,
  Input,
  Label,
  Metric,
  MetricGrid,
  Panel,
  Stack as Rows,
  Timeline,
} from '@nim.zone/ui'
import { api } from './api'
import type { ChangePreview as Preview, PreviewConsequence } from './types'

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Could not compute the preview'
}

/** The preview's tones name what a figure MEANS; the kit's name how it should
 *  read. "good" is reserved for the figure that should reassure, which is
 *  success in the kit's vocabulary. */
const metricTone = { caution: 'warning', good: 'success', neutral: 'neutral' } as const

export function ChangePreviewPanel({
  currentImage,
  onApply,
  serviceID,
}: {
  currentImage?: string
  /** Applying is the owning screen's job. This panel exists so the decision
   *  can be made, and handing the action outward keeps it from becoming a
   *  second place that queues deploys. */
  onApply?: (image: string) => void
  serviceID: string
}) {
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
            <MetricGrid aria-label="What this change touches" columns={4}>
              {preview.consequences.map((item: PreviewConsequence) => (
                <Metric
                  hint={item.note}
                  key={item.label}
                  label={item.label}
                  tone={metricTone[item.tone ?? 'neutral']}
                  value={item.value}
                />
              ))}
            </MetricGrid>

            <div>
              <Label as="p">The sequence, in the order Swarm will perform it</Label>
              {/* Timeline, not a bespoke list: its whole claim is that these
                  happen in this order, which is what an ordered list says to a
                  screen reader and a stack of divs does not. */}
              <Timeline
                entries={preview.steps.map((step, index) => ({
                  body: step.detail,
                  id: `${index}`,
                  time: step.mark,
                  title: step.title,
                }))}
              />
            </div>

            {preview.diff?.length ? (
              <Diff
                caption={`${preview.service} · ${preview.from ?? '—'} → ${preview.to ?? '—'}`}
                lines={preview.diff}
              />
            ) : null}

            <Banner title="If a step fails" tone="neutral">{preview.rollback}</Banner>

            <Caveat title="What this preview cannot promise">
              {preview.unknowns.map((line) => <p key={line}>{line}</p>)}
            </Caveat>

            <DecideBar note="This preview is recorded whether or not you apply it.">
              <Button onClick={() => setPreview(null)} variant="secondary">Discard</Button>
              <Button onClick={() => onApply?.(image)} variant="accent">
                Apply — {preview.consequences.find((c) => c.label === 'Tasks replaced')?.value ?? ''} tasks
              </Button>
            </DecideBar>
          </>
        ) : null}
      </Rows>
    </Panel>
  )
}
