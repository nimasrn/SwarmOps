import { useEffect, useState } from 'react'
import {
  Banner,
  Body,
  Button,
  Columns,
  EmptyState,
  Input,
  Mono,
  Panel,
  Stack as Rows,
  Switch,
  useToast,
} from '@nim.zone/ui'
import { api } from '../../data/api'
import type { Command, SourceStatus } from '../../data/types'
import { sentence, shortID } from '../../lib/format'
import { messageOf } from '../../lib/errors'
import { Screen } from '../../components/screen'
import { RegistryBoundaryPanel } from './deploy-parts/registry'

type Toast = ReturnType<typeof useToast>

/**
 * A bounded build from a tarred context.
 *
 * This is the low-level route. The supported one is Deliver → Deploy from
 * source, which archives the directory, applies `.dockerignore`, and rolls the
 * result out; this screen exists for a context that is already a tar, and for
 * proving what the caps are.
 */
export function ImagesPage({ onDeployFromSource, toast }: { onDeployFromSource: () => void; toast: Toast }) {
  const [sourceStatus, setSourceStatus] = useState<SourceStatus | null>(null)
  useEffect(() => { void api.sourceStatus().then(setSourceStatus).catch(() => setSourceStatus(null)) }, [])
  const [archive, setArchive] = useState<File | null>(null)
  const [image, setImage] = useState('')
  const [dockerfile, setDockerfile] = useState('Dockerfile')
  const [cpus, setCPUs] = useState('2')
  const [memoryMiB, setMemoryMiB] = useState('2048')
  const [push, setPush] = useState(false)
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<Command | null>(null)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!archive) return
    setPending(true)
    setError('')
    setResult(null)
    try {
      const queued = await api.build(archive, { cpus: Number(cpus), dockerfile, image, memoryMiB: Number(memoryMiB), push })
      setResult(queued)
      toast({ message: `Build queued for ${image} (${shortID(queued.id)})`, tone: 'success' })
    } catch (reason) {
      setError(messageOf(reason))
    } finally {
      setPending(false)
    }
  }

  return (
    <Screen
      about="The console accepts a tarred local build context. The companion CLI can archive a directory while applying .dockerignore; both routes enforce the server’s CPU, RAM, image-prefix, and immutable-tag caps."
      actions={<Button iconStart="play" onClick={onDeployFromSource} variant="accent">Deploy from source instead</Button>}
      insights={[
        { hint: 'Caps applied to every build this controller runs', icon: 'activity', label: 'Build CPU cap', value: `${cpus} vCPU` },
        { hint: 'Memory ceiling for the build container', icon: 'package', label: 'Build memory cap', value: `${memoryMiB} MiB` },
        { hint: push ? 'The built image is pushed with the manager’s registry config' : 'The image stays on the manager unless you push it', icon: 'cloud', label: 'Push after build', tone: push ? 'accent' : 'neutral', value: push ? 'Enabled' : 'Disabled' },
      ]}
      page="images"
    >
      {/* Where images GO is the same subject as what was built. The registry
          boundary was its own destination behind the deploy screen, which is
          not where anyone looks for "which registry do we push to". */}
      {sourceStatus ? <RegistryBoundaryPanel status={sourceStatus} /> : null}

      <Columns>
        <Panel eyebrow="Build request" title="Build and optionally push">
          <Rows>
            <Input accept=".tar,application/x-tar" label="Build context (.tar)" onChange={(event) => setArchive(event.target.files?.[0] ?? null)} type="file" />
            <Input hint="An allow-listed registry path with a non-latest tag is required." label="Image" onChange={(event) => setImage(event.target.value)} placeholder="ghcr.io/org/service:2026.08.23" value={image} />
            <Input label="Dockerfile path" onChange={(event) => setDockerfile(event.target.value)} value={dockerfile} />
            <Columns>
              <Input label="vCPU cap" min="0.1" onChange={(event) => setCPUs(event.target.value)} step="0.1" type="number" value={cpus} />
              <Input label="RAM cap (MiB)" min="64" onChange={(event) => setMemoryMiB(event.target.value)} type="number" value={memoryMiB} />
            </Columns>
            <Switch checked={push} description="Requires the manager’s registry config secret. Build arguments are intentionally not accepted because they are not secret-safe." onChange={(event) => setPush(event.target.checked)}>Push after build</Switch>
            {error ? <Banner tone="danger">{error}</Banner> : null}
            <Button disabled={!archive || !image || pending} loading={pending} onClick={() => void submit()} variant="accent">Start bounded build</Button>
          </Rows>
        </Panel>

        <Panel eyebrow="Durable command" title="Build status">
          {result
            ? (
              <Rows>
                <Banner title={`Build ${sentence(result.state).toLowerCase()}`} tone={result.state === 'needs_attention' ? 'warning' : 'success'}>
                  Run <Mono>{result.id}</Mono> owns this source archive until it succeeds or needs operator attention.
                </Banner>
                <Body size="sm">Build output is never returned to the browser or audit trail. Follow this work under Activity → Runs.</Body>
              </Rows>
            )
            : <EmptyState description="A source archive is retained only in protected run storage until its queued build succeeds. Build output is not exposed in the console." icon="upload" title="No build run" />}
        </Panel>
      </Columns>
    </Screen>
  )
}
