import { useState } from 'react'
import {
  Banner,
  Body,
  Button,
  Caveat,
  CodeBlock,
  DataTable,
  EmptyState,
  Label,
  Mono,
  Page,
  Panel,
  Stack as Rows,
  Textarea,
} from '@nim.zone/ui'
import { api } from './api'
import type { ImportGap, ImportMapping, ImportReport } from './types'

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Could not read the manifests'
}

export function KubernetesImportPage() {
  const [manifests, setManifests] = useState('')
  const [report, setReport] = useState<ImportReport | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const read = async () => {
    setBusy(true)
    setError('')
    try {
      setReport(await api.importKubernetes(manifests))
    } catch (reason) {
      setError(messageOf(reason))
      setReport(null)
    } finally {
      setBusy(false)
    }
  }

  const mappingColumns = [
    { header: 'Kubernetes', key: 'from', render: (row: ImportMapping) => <Mono>{row.from}</Mono> },
    { header: 'Becomes', key: 'to', render: (row: ImportMapping) => <Mono>{row.to}</Mono> },
    { header: 'What changes', key: 'note', render: (row: ImportMapping) => row.note ?? '—' },
  ]

  return (
    <Page>
      <Panel
        description="Paste your manifests. SwarmOps reads them and reports what it can run, what it will change, and what it cannot take. Nothing is created — the generated stack is returned for review."
        title="Bring a Kubernetes workload across"
      >
        <Rows>
          <Textarea
            label="Manifests"
            hint="One or more YAML documents, separated by ---."
            onChange={(event) => setManifests(event.target.value)}
            rows={12}
            value={manifests}
          />
          <div>
            <Button disabled={manifests.trim() === ''} loading={busy} onClick={() => void read()} variant="accent">
              Read the manifests
            </Button>
          </div>
          {error ? <Banner tone="danger">{error}</Banner> : null}
        </Rows>
      </Panel>

      {report ? (
        <>
          <Banner
            title={`${report.mappings.length} of ${report.mappings.length + report.gaps.length} objects map cleanly.${report.gaps.length ? ` ${report.gaps.length} have no equivalent and are listed below.` : ''}`}
            tone={report.gaps.length ? 'warning' : 'success'}
          >
            {report.gaps.length
              ? 'Read those before you decide. If you need any of them, Swarm is the wrong target and SwarmOps will not pretend otherwise.'
              : 'Nothing in these manifests needs a decision. Review the generated stack before deploying it.'}
          </Banner>

          {report.errors?.length ? (
            <Banner title="Some documents could not be read" tone="danger">
              {report.errors.map((line) => <p key={line}>{line}</p>)}
            </Banner>
          ) : null}

          <Panel
            description={`${report.mappings.length} object(s) have a Swarm equivalent. Read the "what changes" column — a translation that alters behaviour is listed there rather than hidden.`}
            flush
            title="Maps cleanly"
          >
            <DataTable
              caption="Objects with a Swarm equivalent"
              columns={mappingColumns}
              empty={<EmptyState description="Nothing in these manifests has a Swarm equivalent." icon="layers" title="No mappings" />}
              rowKey={(row: ImportMapping) => row.from}
              rows={report.mappings}
            />
          </Panel>

          {report.gaps.length ? (
            <Panel
              description="These have no honest equivalent. Read them before you decide: if you need any of them, Swarm is the wrong target and SwarmOps will not pretend otherwise."
              title={`No equivalent in Swarm — ${report.gaps.length} object${report.gaps.length === 1 ? '' : 's'} need a decision`}
            >
              <Rows>
                {report.gaps.map((gap: ImportGap) => (
                  <div key={gap.object}>
                    <Label as="p"><Mono>{gap.object}</Mono></Label>
                    <Body size="sm">{gap.why}</Body>
                    <Body size="sm"><strong>Your options: </strong>{gap.options}</Body>
                  </div>
                ))}
                <Caveat title="Why this list is the important half">
                  Most teams leaving Kubernetes were never using these. If you are using them deliberately, staying where
                  you are is a real answer, and a cheaper one than discovering the difference in production.
                </Caveat>
              </Rows>
            </Panel>
          ) : null}

          {report.skipped?.length ? (
            <Panel description="Read and carried no workload meaning on Swarm. Listed so the counts add up." title="Skipped">
              <Body size="sm"><Mono>{report.skipped.join(', ')}</Mono></Body>
            </Panel>
          ) : null}

          {report.compose ? (
            <Panel
              description="Review this before deploying it. It is generated from what mapped, and it does not include anything listed above as needing a decision."
              title="Generated stack"
            >
              <CodeBlock>{report.compose}</CodeBlock>
              <div className="swarmops-import__decide">
                <Body size="sm">Nothing runs until you review the generated stack and preview it.</Body>
                <Button
                  onClick={() => {
                    // Handing the file over rather than deploying it: the value
                    // of this screen is the review, and a one-click deploy from
                    // here would skip it.
                    void navigator.clipboard?.writeText(report.compose ?? '')
                  }}
                  variant="secondary"
                >
                  Copy the Compose stack
                </Button>
              </div>
            </Panel>
          ) : null}
        </>
      ) : null}
    </Page>
  )
}
