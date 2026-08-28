import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  CausalChain,
  Caveat,
  EmptyState,
  Mono,
  Panel,
} from '@nim.zone/ui'
import type { CausalLink } from '@nim.zone/ui'
import type { DiagnosisEvidence, DiagnosisResult } from './types'

/** How long ago a measurement was taken, in the shortest honest form.
 *  Rendered beside every piece of evidence because the age of a reading is
 *  part of how much it is worth. */
function age(observedAt: string): string {
  const taken = Date.parse(observedAt)
  if (Number.isNaN(taken)) return 'time unknown'
  const seconds = Math.max(0, Math.round((Date.now() - taken) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`
  return `${Math.round(seconds / 3600)}h ago`
}

function source(evidence: DiagnosisEvidence): string {
  return `${evidence.source} · ${age(evidence.observedAt)}`
}

export function ServiceDiagnosis({
  onAction,
  result,
  serviceName,
}: {
  onAction?: (kind: string) => void
  result: DiagnosisResult
  serviceName: string
}) {
  const { chain, refusal } = result

  if (chain) {
    const links: CausalLink[] = chain.links.map((link) => ({
      claim: link.claim,
      evidence: link.evidence?.label,
      source: link.evidence ? source(link.evidence) : undefined,
      step: link.step,
      tone: link.tone,
    }))

    const primary = chain.actions?.find((action) => action.primary)
    const rest = chain.actions?.filter((action) => !action.primary) ?? []

    return (
      <Panel
        description="Read top to bottom. Each line is a claim; the chip under it is the measurement behind it and where that came from."
        eyebrow={<Mono>{chain.rule}</Mono>}
        title={`Why ${serviceName} is not converged`}
      >
        <CausalChain
          caveat={
            chain.caveats?.length ? (
              <Caveat title="What this diagnosis cannot see">
                {chain.caveats.map((caveat) => <p key={caveat}>{caveat}</p>)}
              </Caveat>
            ) : undefined
          }
          links={links}
          resolution={
            primary ? (
              <div className="swarmops-diagnosis__fix">
                <p className="swarmops-diagnosis__fix-label">{primary.label}</p>
                {primary.detail ? <p className="swarmops-diagnosis__fix-detail">{primary.detail}</p> : null}
                <div className="swarmops-diagnosis__fix-actions">
                  <Button onClick={() => onAction?.(primary.kind)} size="sm" variant="accent">
                    {primary.label}
                  </Button>
                  {rest.map((action) => (
                    <Button key={action.kind} onClick={() => onAction?.(action.kind)} size="sm" variant="secondary">
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>
            ) : undefined
          }
        />
      </Panel>
    )
  }

  // The refusal is not an error state and must not be styled as one. It is the
  // engine declining to invent, which is the behaviour that makes every chain
  // above believable.
  return (
    <Panel eyebrow={<Mono>no rule fired</Mono>} title={`SwarmOps cannot explain ${serviceName}`}>
      <EmptyState
        description={refusal?.reason ?? 'No explanation is available from the measurements at hand.'}
        icon="search"
        title="Nothing here is a guess"
      />
      {refusal?.evidence?.length ? (
        <dl className="swarmops-diagnosis__evidence">
          {refusal.evidence.map((item) => (
            <div key={`${item.source}-${item.label}`}>
              <dt>{item.label}</dt>
              <dd>{source(item)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </Panel>
  )
}

/** Fetches a diagnosis for one service. Kept separate from the view so the
 *  view stays a pure function of a result and can be rendered from a fixture. */
export function useServiceDiagnosis(
  serviceID: string | null,
  fetcher: (id: string) => Promise<DiagnosisResult>,
) {
  const [result, setResult] = useState<DiagnosisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const run = useCallback(async () => {
    if (!serviceID) return
    setLoading(true)
    setError(null)
    try {
      setResult(await fetcher(serviceID))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not reach the controller')
    } finally {
      setLoading(false)
    }
  }, [fetcher, serviceID])

  useEffect(() => { void run() }, [run])

  return { error, loading, refresh: run, result }
}
