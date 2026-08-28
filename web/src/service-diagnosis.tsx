import { useCallback, useEffect, useState } from 'react'
import {
  Banner,
  Body,
  Button,
  CausalChain,
  Caveat,
  EmptyState,
  Mono,
  Panel,
} from '@nim.zone/ui'
import type { CausalLink } from '@nim.zone/ui'
import { api } from './api'
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

/** The engine's vocabulary, fetched once. Shown beside a refusal because an
 *  engine whose rule set is secret cannot be trusted at the edges of it: told
 *  only "no rule fired", an operator cannot tell a gap in the engine from a
 *  genuinely inexplicable service. */
function useDiagnosisRules(enabled: boolean) {
  const [rules, setRules] = useState<string[]>([])
  useEffect(() => {
    if (!enabled) return
    let live = true
    void api.diagnosisRules()
      .then((response: { rules: string[] }) => { if (live) setRules(response.rules) })
      .catch(() => { /* The rule list is context, never the reason a page works. */ })
    return () => { live = false }
  }, [enabled])
  return rules
}

export function ServiceDiagnosis({
  error,
  loading,
  onAction,
  result,
  serviceName,
}: {
  /** Set when the diagnosis could not be fetched at all. */
  error?: string | null
  loading?: boolean
  onAction?: (kind: string) => void
  result: DiagnosisResult | null
  serviceName: string
}) {
  // A failed request must not render as nothing. This panel only appears for a
  // service that is already degraded, so an empty space where the explanation
  // should be reads as "nothing is wrong" — the single most misleading thing
  // this console could do, and the opposite of what it is for.
  if (error) {
    return (
      <Panel eyebrow={<Mono>unavailable</Mono>} title={`Why ${serviceName} is not converged`}>
        <Banner title="The diagnosis could not be fetched" tone="danger">
          {error}. This says nothing about the service — only that the controller could not be reached to ask.
        </Banner>
      </Panel>
    )
  }

  if (!result) {
    if (loading) {
    return (
      <Panel eyebrow={<Mono>working</Mono>} title={`Why ${serviceName} is not converged`}>
        <Body size="sm">Gathering measurements from the manager and the host probes.</Body>
      </Panel>
      )
    }
    return null
  }

  const { chain, refusal } = result ?? {}
  // Only fetched when a refusal is on screen; the list is context for "no rule
  // fired" and noise anywhere else.
  const rules = useDiagnosisRules(Boolean(result && !result.chain))

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
        <div className="swarmops-diagnosis__layout">
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
                  {/* These take you to the screen that owns the action rather
                      than performing it here. Prune is gated behind an explicit
                      confirmation, and running a destructive command from the
                      panel that just diagnosed the problem would bypass the
                      deliberation that gate exists to force. */}
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

        <aside className="swarmops-diagnosis__rail">
          {chain.elsewhere ? (
            <section>
              <p className="swarmops-diagnosis__rail-head">The same answer, elsewhere</p>
              <Body size="sm">
                On Kubernetes this diagnosis is {chain.elsewhere.commands.length} commands
                {chain.elsewhere.note ? ' and a judgement call' : ''}.
              </Body>
              <ol className="swarmops-diagnosis__commands">
                {chain.elsewhere.commands.map((command) => (
                  <li key={command}><Mono>{command}</Mono></li>
                ))}
              </ol>
              {chain.elsewhere.note ? <Body size="sm">{chain.elsewhere.note}</Body> : null}
            </section>
          ) : null}

          {chain.evidence?.length ? (
            <section>
              <p className="swarmops-diagnosis__rail-head">Evidence trail</p>
              <Body size="sm">Every measurement this chain used, with when it was taken.</Body>
              <dl className="swarmops-diagnosis__trail">
                {chain.evidence.map((item, index) => (
                  <div key={`${item.source}-${index}`}>
                    <dt>{item.label}<span>{item.source}</span></dt>
                    <dd><Mono>{age(item.observedAt)}</Mono></dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
        </aside>
        </div>
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
      {rules.length ? (
        <div className="swarmops-diagnosis__rules">
          <Body size="sm">
            SwarmOps can currently explain {rules.length} kind{rules.length === 1 ? '' : 's'} of failure. None of them fits
            what this service is doing, which may mean the cause is outside that list rather than absent.
          </Body>
          <ul>
            {rules.map((rule) => <li key={rule}><Mono>{rule}</Mono></li>)}
          </ul>
        </div>
      ) : null}
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
