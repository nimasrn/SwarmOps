import { useCallback, useEffect, useState } from 'react'
import {
  Banner,
  Body,
  Button,
  Caption,
  Checkbox,
  Icon,
  Inline,
  Input,
  Mono,
  Panel,
  RadioGroup,
  Radio,
  Select,
  Spinner,
  Stack as Rows,
  useToast,
} from '@nim.zone/ui'
import { api } from '../../data/api'
import type {
  PlatformDefinition,
  PlatformInput,
  PlatformManifest,
  PlatformMode,
  PlatformNode,
  PlatformWorkload,
  PreflightReport,
} from '../../data/types'
import { messageOf } from '../../lib/errors'

type Toast = ReturnType<typeof useToast>

const EMPTY_MANIFEST: PlatformManifest = {
  apiVersion: 'swarmops.nim.zone/v1alpha1',
  backup: { prefix: '', provider: '', schedule: '' },
  build: { cacheNodeLabel: '', nodeLabel: '' },
  dns: { providers: [], resolvers: [] },
  ingress: { publicIPs: [] },
  kind: 'Platform',
  namespace: '',
  nodes: [],
  registry: { authSecret: '', host: 'ghcr.io', mode: 'ghcr', namespace: '' },
  storage: [],
  workloads: [],
}

const EMPTY_WORKLOAD: PlatformWorkload = {
  domain: '',
  domainOptional: false,
  domainSuffixes: [],
  name: '',
  profile: 'application',
  replicas: 1,
  resolver: '',
  resources: { cpuCores: 0.25, diskGiB: 1, memoryMiB: 256 },
}

const EMPTY_NODE: PlatformNode = {
  availableCPUCores: 0,
  availableDiskGiB: 0,
  availableMemoryMiB: 0,
  cpuCores: 0,
  labels: {},
  memoryMiB: 0,
  name: '',
}

/** A manifest arrives from Go with null where a list is empty. */
function list<T>(value: T[] | null | undefined) { return value ?? [] }

function labelText(labels: Record<string, string> | null | undefined) {
  return Object.entries(labels ?? {}).map(([key, value]) => `${key}=${value}`).join(', ')
}

function parseLabels(text: string) {
  const labels: Record<string, string> = {}
  for (const pair of text.split(',')) {
    const [key, ...rest] = pair.split('=')
    if (key.trim() && rest.length) labels[key.trim()] = rest.join('=').trim()
  }
  return labels
}

function csv(values: string[] | null | undefined) { return list(values).join(', ') }
function parseCSV(text: string) { return text.split(',').map((value) => value.trim()).filter(Boolean) }

/**
 * The platform definition, in the console.
 *
 * SwarmOps admits a browser deployment only against a reviewed platform
 * manifest: it decides the namespace, the registry images may come from, the
 * certificate resolvers, and the application slots — each with the domain and
 * the resource ceiling it owns. That manifest used to arrive one way only, as
 * a file mounted on the controller, which an operator running SwarmOps from a
 * browser cannot write.
 *
 * So there are three honest answers to "what admits deployments here", and
 * this screen asks for one of them: a manifest authored here, no manifest at
 * all, or nothing chosen yet. The third refuses deployment, which is what an
 * unconfigured controller already did.
 */
export function PlatformAdmissionTab({ toast }: { toast: Toast }) {
  const [definition, setDefinition] = useState<PlatformDefinition | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [report, setReport] = useState<PreflightReport | null>(null)

  const [mode, setMode] = useState<PlatformMode>('unset')
  const [manifest, setManifest] = useState<PlatformManifest>(EMPTY_MANIFEST)
  const [namespace, setNamespace] = useState('')
  const [confirmation, setConfirmation] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const next = await api.platform()
      setDefinition(next)
      setMode(next.mode === 'file' ? 'manifest' : next.mode)
      setManifest({ ...EMPTY_MANIFEST, ...next.manifest })
      setNamespace(next.namespace)
      setReport(next.report ?? null)
      setError('')
    } catch (failure) {
      setError(messageOf(failure))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const input = (): PlatformInput => ({ confirmation, manifest, mode, namespace })
  const editable = Boolean(definition?.editable)
  const patch = (changes: Partial<PlatformManifest>) => setManifest((current) => ({ ...current, ...changes }))

  const check = async () => {
    try {
      setReport(await api.checkPlatform(input()))
      setError('')
    } catch (failure) {
      setError(messageOf(failure))
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      const next = await api.savePlatform(input())
      setDefinition(next)
      setReport(next.report ?? null)
      setConfirmation('')
      setError('')
      toast({ message: 'The controller is using this platform definition now. No restart is needed.', tone: 'success' })
    } catch (failure) {
      setError(messageOf(failure))
    } finally {
      setSaving(false)
    }
  }

  // The smallest manifest preflight calls admissible is four things: the two
  // constants, a namespace, a registry, and one measured node. Everything else
  // on this screen — DNS providers, resolvers, object storage, backups, build
  // labels, and the slot list itself — is optional, and a first deployment
  // declares its own slot where the controller owns the definition. An
  // operator who wants "the ordinary one" should not have to learn that by
  // reading preflight findings one at a time.
  const startFromDefault = async () => {
    const name = (namespace || definition?.namespace || 'apps').toLowerCase()
    let nodes: PlatformNode[] = []
    try {
      nodes = await api.platformNodes()
    } catch (failure) {
      setError(messageOf(failure))
    }
    const next: PlatformManifest = {
      ...EMPTY_MANIFEST,
      namespace: name,
      nodes,
      registry: { authSecret: '', host: 'ghcr.io', mode: 'ghcr', namespace: name },
      workloads: [],
    }
    setMode('manifest')
    setManifest(next)
    setNamespace(name)
    try {
      setReport(await api.checkPlatform({ confirmation: '', manifest: next, mode: 'manifest', namespace: name }))
    } catch (failure) {
      setError(messageOf(failure))
    }
  }

  const importNodes = async () => {
    try {
      const nodes = await api.platformNodes()
      patch({ nodes })
      // Docker reports a node's physical capacity; availability comes from the
      // host probe. Importing zeroes and letting preflight refuse them with
      // "available CPU, memory, and disk must be measured" sends the operator
      // looking for a manifest mistake that is not in the manifest.
      const unmeasured = nodes.filter((node) => !node.availableCPUCores || !node.availableMemoryMiB || !node.availableDiskGiB)
      if (unmeasured.length) {
        toast({
          duration: 0,
          message: `${unmeasured.map((node) => node.name).join(', ')} reported no available capacity. Only the host probe measures usage and disk, so install the node inventory agent on Platform → Metrics, traces & logs, then import again — preflight refuses a node whose availability is zero.`,
          tone: 'danger',
        })
        return
      }
      toast({ message: `Measured ${nodes.length} node${nodes.length === 1 ? '' : 's'} from the selected cluster`, tone: 'success' })
    } catch (failure) {
      setError(messageOf(failure))
    }
  }

  if (loading && !definition) return <Spinner label="Reading the platform definition" />

  const errors = list(report?.findings).filter((finding) => finding.level === 'error')
  const warnings = list(report?.findings).filter((finding) => finding.level === 'warning')

  return (
    <Rows>
      {error ? <Banner tone="danger" title="The platform definition was not applied">{error}</Banner> : null}

      {editable && (definition?.mode === 'unset' || !definition) ? (
        <Banner tone="info" title="A platform definition is the list this controller checks a deployment against">
          <Rows gap="tight">
            <Body size="sm">
              It answers four questions before anything runs: which namespace every stack is prefixed with, which
              registry application images may come from, what capacity the cluster actually has, and which
              application slots exist with the domain and ceiling each one owns. Only the first three are required —
              a deployment declares its own slot where the controller owns the definition.
            </Body>
            <Body size="sm">
              The default below is the ordinary one: this namespace, GitHub Container Registry, the nodes measured
              from the selected cluster, and no slots yet. DNS providers, certificate resolvers, object storage,
              backups and build placement stay empty until something needs them.
            </Body>
            <Inline gap="tight">
              <Button onClick={() => void startFromDefault()} size="sm" variant="accent">Start from a default definition</Button>
            </Inline>
          </Rows>
        </Banner>
      ) : null}

      {definition?.fileManaged ? (
        <Banner tone="info" title="This controller loads a reviewed manifest from a file">
          <Mono>{definition.manifestPath}</Mono> is mounted on the controller and stays authoritative. It is shown here
          so you can read what admits deployments; change it where it is reviewed, not from a browser.
        </Banner>
      ) : null}

      <Panel
        caption={definition?.updatedAt && definition.updatedBy ? `Last changed by ${definition.updatedBy}` : undefined}
        description="What this controller checks a browser deployment against before it runs."
        title="Platform definition"
      >
        <Rows>
          <RadioGroup label="Where the platform definition comes from" onChange={(value) => setMode(value as PlatformMode)} value={mode}>
            <Radio
              description="Namespace, registry, resolvers, measured nodes, and the application slots each deployment is held to. Written here, sealed on the controller, and checked by the same preflight a mounted manifest goes through."
              disabled={!editable}
              value="manifest"
            >
              A manifest authored here
            </Radio>
            <Radio
              description="This install has no platform manifest and must not have one. Application names, domains, and resource requests stop being checked against a reviewed list."
              disabled={!editable}
              value="unmanaged"
            >
              No manifest
            </Radio>
            <Radio
              description="Nothing is chosen yet, so browser deployment stays refused. This is what an unconfigured controller already does."
              disabled={!editable}
              value="unset"
            >
              Not configured
            </Radio>
          </RadioGroup>

          {mode === 'unmanaged' ? (
            <>
              <Banner tone="warning" title="What stops being enforced">
                <Rows gap="tight">
                  <Body size="sm">
                    Without a manifest there is no reviewed list to check a deployment against, so four checks stop:
                    an application may take any name in the namespace below, claim any domain, name any certificate
                    resolver, and reserve as much CPU and memory as the cluster will schedule. A registry namespace is
                    no longer required of application images.
                  </Body>
                  <Body size="sm">
                    What stays: every stack is confined to that namespace, one stack still cannot mount another's
                    secrets, configs, volumes, or networks, public routes still go through the gateway with a
                    certificate resolver, and each Docker host still enforces its own build and image permissions.
                  </Body>
                </Rows>
              </Banner>
              <Input
                disabled={!editable}
                hint="Every stack deployed from this console is prefixed with it, so a deployment cannot name a stack a Git-managed workload owns."
                label="Namespace"
                onChange={(event) => setNamespace(event.target.value)}
                placeholder="apps"
                value={namespace}
              />
              <Input
                disabled={!editable}
                hint={`Type ${definition?.confirmationPhrase ?? 'NO_PLATFORM_MANIFEST'} to confirm this install must not have a manifest.`}
                label="Confirmation"
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder={definition?.confirmationPhrase ?? 'NO_PLATFORM_MANIFEST'}
                value={confirmation}
              />
            </>
          ) : null}

          {mode === 'manifest' ? (
            <ManifestEditor disabled={!editable} manifest={manifest} onImportNodes={() => void importNodes()} patch={patch} />
          ) : null}

          <Inline>
            <Button disabled={!editable || saving} loading={saving} onClick={() => void save()} variant="accent">
              Apply platform definition
            </Button>
            {mode === 'manifest' ? <Button onClick={() => void check()} variant="secondary">Check without saving</Button> : null}
            <Button onClick={() => void load()} variant="ghost">Discard changes</Button>
          </Inline>
        </Rows>
      </Panel>

      {report && mode === 'manifest' ? (
        <Panel
          caption={errors.length ? `${errors.length} must be fixed` : 'Admissible'}
          description="The same deterministic checks the controller runs before sealing this manifest. Nothing here contacts a registry, DNS provider, or node."
          title="Preflight"
        >
          {errors.length === 0 && warnings.length === 0 ? (
            <Body size="sm">No findings. This manifest is admissible.</Body>
          ) : (
            <Rows gap="tight">
              {[...errors, ...warnings].map((finding) => (
                <Inline key={`${finding.code}-${finding.subject ?? ''}`} gap="tight">
                  <Icon name={finding.level === 'error' ? 'alert' : 'info'} size="sm" tone={finding.level === 'error' ? 'danger' : 'warning'} />
                  <Body size="sm">
                    <Mono>{finding.subject || finding.code}</Mono> — {finding.message}
                  </Body>
                </Inline>
              ))}
            </Rows>
          )}
        </Panel>
      ) : null}

      <Panel description="What deployment offers right now, from the definition in force." title="Application slots in force">
        {definition?.unmanaged ? (
          <Body size="sm">
            This install deploys without slots. Deploy accepts a free-form application name inside{' '}
            <Mono>{definition.namespace}</Mono>.
          </Body>
        ) : list(definition?.slots).length === 0 ? (
          <Body size="sm">No slot is approved, so browser deployment is refused.</Body>
        ) : (
          <Rows gap="tight">
            {list(definition?.slots).map((slot) => (
              <Inline key={slot.name} gap="tight">
                <Icon name="shield" size="sm" />
                <Body size="sm">
                  <Mono>{slot.name}</Mono> — {slot.domain || csv(slot.domainSuffixes) || 'internal only'} · {slot.replicas} ×{' '}
                  {slot.cpuCores} vCPU / {slot.memoryMiB} MiB
                </Body>
              </Inline>
            ))}
          </Rows>
        )}
      </Panel>
    </Rows>
  )
}

function ManifestEditor({ disabled, manifest, onImportNodes, patch }: {
  disabled: boolean
  manifest: PlatformManifest
  onImportNodes: () => void
  patch: (changes: Partial<PlatformManifest>) => void
}) {
  const nodes = list(manifest.nodes)
  const workloads = list(manifest.workloads)
  const providers = list(manifest.dns.providers)
  const resolvers = list(manifest.dns.resolvers)
  const storage = list(manifest.storage)

  const putNode = (index: number, changes: Partial<PlatformNode>) =>
    patch({ nodes: nodes.map((node, position) => (position === index ? { ...node, ...changes } : node)) })
  const putWorkload = (index: number, changes: Partial<PlatformWorkload>) =>
    patch({ workloads: workloads.map((workload, position) => (position === index ? { ...workload, ...changes } : workload)) })

  return (
    <Rows>
      <Panel title="Cluster" variant="plain">
        <Rows>
          <Input
            disabled={disabled}
            hint="Every stack this console deploys is prefixed with it."
            label="Namespace"
            onChange={(event) => patch({ namespace: event.target.value })}
            placeholder="production"
            value={manifest.namespace}
          />
          <Inline>
            <Select
              disabled={disabled}
              label="Registry"
              onChange={(event) => patch({ registry: { ...manifest.registry, mode: event.target.value, host: event.target.value === 'ghcr' ? 'ghcr.io' : manifest.registry.host } })}
              options={[{ label: 'GitHub Container Registry', value: 'ghcr' }, { label: 'Private registry', value: 'private' }]}
              value={manifest.registry.mode}
            />
            <Input
              disabled={disabled || manifest.registry.mode === 'ghcr'}
              label="Registry host"
              onChange={(event) => patch({ registry: { ...manifest.registry, host: event.target.value } })}
              placeholder="registry.example.com"
              value={manifest.registry.host}
            />
            <Input
              disabled={disabled}
              hint="Application images must come from this namespace."
              label="Registry namespace"
              onChange={(event) => patch({ registry: { ...manifest.registry, namespace: event.target.value } })}
              placeholder="your-org"
              value={manifest.registry.namespace}
            />
          </Inline>
          {manifest.registry.mode === 'private' ? (
            <Input
              disabled={disabled}
              hint="The name of a versioned Swarm secret holding the pull credential. The value never appears here."
              label="Registry auth secret"
              onChange={(event) => patch({ registry: { ...manifest.registry, authSecret: event.target.value } })}
              placeholder="registry_auth_v1"
              value={manifest.registry.authSecret}
            />
          ) : null}
          <Input
            disabled={disabled}
            hint="Comma separated. Needed for an HTTP-01 certificate challenge."
            label="Public ingress IPs"
            onChange={(event) => patch({ ingress: { publicIPs: parseCSV(event.target.value) } })}
            placeholder="203.0.113.10"
            value={csv(manifest.ingress.publicIPs)}
          />
          <Inline>
            <Input
              disabled={disabled}
              hint="Optional node label a build is pinned to."
              label="Build node label"
              onChange={(event) => patch({ build: { ...manifest.build, nodeLabel: event.target.value } })}
              value={manifest.build.nodeLabel}
            />
            <Input
              disabled={disabled}
              label="Build cache node label"
              onChange={(event) => patch({ build: { ...manifest.build, cacheNodeLabel: event.target.value } })}
              value={manifest.build.cacheNodeLabel}
            />
          </Inline>
        </Rows>
      </Panel>

      <Panel
        actions={<Button disabled={disabled} iconStart="refresh" onClick={onImportNodes} size="sm" variant="secondary">Measure from cluster</Button>}
        caption={`${nodes.length} declared`}
        description="Capacity is what a slot's reservation is checked against. Measuring reads the selected cluster rather than asking you to retype what Swarm already knows; every value stays editable."
        title="Nodes"
        variant="plain"
      >
        <Rows>
          {nodes.map((node, index) => (
            <Rows gap="tight" key={`node-${index}`}>
              <Inline>
                <Input disabled={disabled} label="Hostname" onChange={(event) => putNode(index, { name: event.target.value })} value={node.name} />
                <Input disabled={disabled} label="vCPU" onChange={(event) => putNode(index, { cpuCores: Number(event.target.value) })} type="number" value={String(node.cpuCores)} />
                <Input disabled={disabled} label="Memory (MiB)" onChange={(event) => putNode(index, { memoryMiB: Number(event.target.value) })} type="number" value={String(node.memoryMiB)} />
              </Inline>
              <Inline>
                <Input disabled={disabled} label="Available vCPU" onChange={(event) => putNode(index, { availableCPUCores: Number(event.target.value) })} type="number" value={String(node.availableCPUCores)} />
                <Input disabled={disabled} label="Available memory (MiB)" onChange={(event) => putNode(index, { availableMemoryMiB: Number(event.target.value) })} type="number" value={String(node.availableMemoryMiB)} />
                <Input disabled={disabled} label="Available disk (GiB)" onChange={(event) => putNode(index, { availableDiskGiB: Number(event.target.value) })} type="number" value={String(node.availableDiskGiB)} />
              </Inline>
              <Inline>
                <Input disabled={disabled} hint="key=value, comma separated" label="Labels" onChange={(event) => putNode(index, { labels: parseLabels(event.target.value) })} value={labelText(node.labels)} />
                <Button disabled={disabled} onClick={() => patch({ nodes: nodes.filter((_, position) => position !== index) })} size="sm" variant="ghost">Remove</Button>
              </Inline>
            </Rows>
          ))}
          {nodes.length === 0 ? <Body size="sm">No node is declared, so no workload can be placed.</Body> : null}
          <Inline>
            <Button disabled={disabled} onClick={() => patch({ nodes: [...nodes, { ...EMPTY_NODE }] })} size="sm" variant="secondary">Add a node</Button>
          </Inline>
        </Rows>
      </Panel>

      <Panel
        caption={`${providers.length} provider${providers.length === 1 ? '' : 's'} · ${resolvers.length} resolver${resolvers.length === 1 ? '' : 's'}`}
        description="A slot with a domain names one of these resolvers. Credentials are named here, never held here."
        title="DNS and certificates"
        variant="plain"
      >
        <Rows>
          {providers.map((provider, index) => (
            <Inline key={`provider-${index}`}>
              <Input disabled={disabled} label="Provider name" onChange={(event) => patch({ dns: { ...manifest.dns, providers: providers.map((entry, position) => position === index ? { ...entry, name: event.target.value } : entry) } })} value={provider.name} />
              <Select disabled={disabled} label="Type" onChange={(event) => patch({ dns: { ...manifest.dns, providers: providers.map((entry, position) => position === index ? { ...entry, type: event.target.value } : entry) } })} options={[{ label: 'Cloudflare', value: 'cloudflare' }, { label: 'ArvanCloud', value: 'arvancloud' }]} value={provider.type} />
              <Input disabled={disabled} hint="Versioned Swarm secret name" label="Credential secret" onChange={(event) => patch({ dns: { ...manifest.dns, providers: providers.map((entry, position) => position === index ? { ...entry, credentialSecret: event.target.value } : entry) } })} value={provider.credentialSecret} />
              <Button disabled={disabled} onClick={() => patch({ dns: { ...manifest.dns, providers: providers.filter((_, position) => position !== index) } })} size="sm" variant="ghost">Remove</Button>
            </Inline>
          ))}
          <Inline>
            <Button disabled={disabled} onClick={() => patch({ dns: { ...manifest.dns, providers: [...providers, { credentialSecret: '', name: '', type: 'cloudflare' }] } })} size="sm" variant="secondary">Add a DNS provider</Button>
          </Inline>
          {resolvers.map((resolver, index) => (
            <Inline key={`resolver-${index}`}>
              <Input disabled={disabled} label="Resolver name" onChange={(event) => patch({ dns: { ...manifest.dns, resolvers: resolvers.map((entry, position) => position === index ? { ...entry, name: event.target.value } : entry) } })} placeholder="le" value={resolver.name} />
              <Select disabled={disabled} label="Challenge" onChange={(event) => patch({ dns: { ...manifest.dns, resolvers: resolvers.map((entry, position) => position === index ? { ...entry, challenge: event.target.value } : entry) } })} options={[{ label: 'DNS-01', value: 'dns' }, { label: 'HTTP-01', value: 'http' }]} value={resolver.challenge} />
              <Input disabled={disabled || resolver.challenge === 'http'} hint="A DNS-01 resolver names a provider above." label="DNS provider" onChange={(event) => patch({ dns: { ...manifest.dns, resolvers: resolvers.map((entry, position) => position === index ? { ...entry, provider: event.target.value } : entry) } })} value={resolver.provider} />
              <Button disabled={disabled} onClick={() => patch({ dns: { ...manifest.dns, resolvers: resolvers.filter((_, position) => position !== index) } })} size="sm" variant="ghost">Remove</Button>
            </Inline>
          ))}
          <Inline>
            <Button disabled={disabled} onClick={() => patch({ dns: { ...manifest.dns, resolvers: [...resolvers, { challenge: 'dns', name: '', provider: '' }] } })} size="sm" variant="secondary">Add a certificate resolver</Button>
          </Inline>
        </Rows>
      </Panel>

      <Panel
        caption={`${workloads.length} declared`}
        description="One entry per thing this cluster runs. An application-profile workload is a slot the deploy screen offers; every other profile is deployed from its own reviewed Git manifest and appears here only so its capacity is counted."
        title="Workloads and application slots"
        variant="plain"
      >
        <Rows>
          {workloads.map((workload, index) => (
            <Rows gap="tight" key={`workload-${index}`}>
              <Inline>
                <Input disabled={disabled} label="Name" onChange={(event) => putWorkload(index, { name: event.target.value })} placeholder="api" value={workload.name} />
                <Select
                  disabled={disabled}
                  label="Profile"
                  onChange={(event) => putWorkload(index, { profile: event.target.value })}
                  options={[
                    { label: 'application', value: 'application' },
                    { label: 'observability', value: 'observability' },
                    { label: 'postgres-primary-replica', value: 'postgres-primary-replica' },
                    { label: 'mongo-replicaset', value: 'mongo-replicaset' },
                    { label: 'redis-sentinel', value: 'redis-sentinel' },
                    { label: 'jitsi', value: 'jitsi' },
                  ]}
                  value={workload.profile}
                />
                <Input disabled={disabled} label="Replicas" min="1" onChange={(event) => putWorkload(index, { replicas: Number(event.target.value) })} type="number" value={String(workload.replicas)} />
              </Inline>
              <Inline>
                <Input disabled={disabled} label="vCPU per replica" onChange={(event) => putWorkload(index, { resources: { ...workload.resources, cpuCores: Number(event.target.value) } })} step="0.25" type="number" value={String(workload.resources?.cpuCores ?? 0)} />
                <Input disabled={disabled} label="Memory (MiB)" onChange={(event) => putWorkload(index, { resources: { ...workload.resources, memoryMiB: Number(event.target.value) } })} type="number" value={String(workload.resources?.memoryMiB ?? 0)} />
                <Input disabled={disabled} label="Disk (GiB)" onChange={(event) => putWorkload(index, { resources: { ...workload.resources, diskGiB: Number(event.target.value) } })} type="number" value={String(workload.resources?.diskGiB ?? 0)} />
              </Inline>
              <Inline>
                <Input disabled={disabled} hint="The one hostname this slot owns." label="Domain" onChange={(event) => putWorkload(index, { domain: event.target.value })} placeholder="api.example.com" value={workload.domain ?? ''} />
                <Input disabled={disabled} hint="Comma separated. Any hostname under these is this slot's to claim." label="Domain suffixes" onChange={(event) => putWorkload(index, { domainSuffixes: parseCSV(event.target.value) })} value={csv(workload.domainSuffixes)} />
                <Input disabled={disabled} hint="A resolver declared above." label="Resolver" onChange={(event) => putWorkload(index, { resolver: event.target.value })} placeholder="le" value={workload.resolver ?? ''} />
              </Inline>
              <Inline>
                <Checkbox
                  checked={Boolean(workload.domainOptional)}
                  description="The slot may be deployed with no public hostname, and a domain may be assigned or removed later."
                  disabled={disabled}
                  onChange={(event) => putWorkload(index, { domainOptional: event.target.checked })}
                >
                  Domain is optional
                </Checkbox>
                <Button disabled={disabled} onClick={() => patch({ workloads: workloads.filter((_, position) => position !== index) })} size="sm" variant="ghost">Remove</Button>
              </Inline>
            </Rows>
          ))}
          {workloads.length === 0 ? <Body size="sm">No workload is declared, so the deploy screen has no slot to offer.</Body> : null}
          <Inline>
            <Button disabled={disabled} onClick={() => patch({ workloads: [...workloads, { ...EMPTY_WORKLOAD }] })} size="sm" variant="secondary">Add a workload</Button>
          </Inline>
        </Rows>
      </Panel>

      <Panel
        caption={`${storage.length} provider${storage.length === 1 ? '' : 's'}`}
        description="Optional. Object storage a workload may be pointed at, and the backup schedule that writes to it."
        title="Object storage and backup"
        variant="plain"
      >
        <Rows>
          {storage.map((provider, index) => (
            <Inline key={`storage-${index}`}>
              <Input disabled={disabled} label="Name" onChange={(event) => patch({ storage: storage.map((entry, position) => position === index ? { ...entry, name: event.target.value } : entry) })} value={provider.name} />
              <Input disabled={disabled} hint="HTTPS S3-compatible base URL" label="Endpoint" onChange={(event) => patch({ storage: storage.map((entry, position) => position === index ? { ...entry, endpoint: event.target.value } : entry) })} value={provider.endpoint} />
              <Input disabled={disabled} label="Bucket" onChange={(event) => patch({ storage: storage.map((entry, position) => position === index ? { ...entry, bucket: event.target.value } : entry) })} value={provider.bucket} />
              <Input disabled={disabled} hint="Versioned Swarm secret name" label="Credential secret" onChange={(event) => patch({ storage: storage.map((entry, position) => position === index ? { ...entry, credentialSecret: event.target.value } : entry) })} value={provider.credentialSecret} />
              <Button disabled={disabled} onClick={() => patch({ storage: storage.filter((_, position) => position !== index) })} size="sm" variant="ghost">Remove</Button>
            </Inline>
          ))}
          <Inline>
            <Button disabled={disabled} onClick={() => patch({ storage: [...storage, { bucket: '', credentialSecret: '', endpoint: '', name: '' }] })} size="sm" variant="secondary">Add a storage provider</Button>
          </Inline>
          <Inline>
            <Input disabled={disabled} hint="A storage provider above." label="Backup provider" onChange={(event) => patch({ backup: { ...manifest.backup, provider: event.target.value } })} value={manifest.backup.provider} />
            <Input disabled={disabled} label="Backup prefix" onChange={(event) => patch({ backup: { ...manifest.backup, prefix: event.target.value } })} placeholder="backups/production" value={manifest.backup.prefix} />
            <Input disabled={disabled} hint="Five-field cron expression." label="Backup schedule" onChange={(event) => patch({ backup: { ...manifest.backup, schedule: event.target.value } })} placeholder="0 3 * * *" value={manifest.backup.schedule} />
          </Inline>
          <Caption>Leave all three empty to declare no backup.</Caption>
        </Rows>
      </Panel>
    </Rows>
  )
}
