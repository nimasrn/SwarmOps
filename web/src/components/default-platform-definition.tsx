import { useState } from 'react'
import { Button, useToast } from '@nim.zone/ui'
import { api } from '../data/api'
import type { PlatformDefinition, PlatformManifest } from '../data/types'
import { messageOf } from '../lib/errors'

type Toast = ReturnType<typeof useToast>

/** The two constants a manifest carries, which no operator should retype. */
const API_VERSION = 'swarmops.nim.zone/v1alpha1'
const KIND = 'Platform'

/** What the default definition is, in one place, so every screen that offers
    it offers the same thing: a namespace, GitHub Container Registry, the nodes
    measured from the selected cluster, and no slots — a first deployment
    declares the slot it names. */
export function defaultPlatformManifest(namespace: string, nodes: PlatformManifest['nodes']): PlatformManifest {
  return {
    apiVersion: API_VERSION,
    backup: { prefix: '', provider: '', schedule: '' },
    build: { cacheNodeLabel: '', nodeLabel: '' },
    dns: { providers: [], resolvers: [] },
    ingress: { publicIPs: [] },
    kind: KIND,
    namespace,
    nodes,
    registry: { authSecret: '', host: 'ghcr.io', mode: 'ghcr', namespace },
    storage: [],
    workloads: [],
  }
}

/**
 * The whole platform decision, where the operator hits it.
 *
 * A controller with no definition refuses every browser deployment, and the
 * screens that reported it sent the operator to a third screen to author a
 * manifest — which is a document most people meet for the first time at
 * exactly the moment they are trying to deploy something. The definition is
 * still authored, checked and sealed the same way; this only fills in the
 * parts that have one sensible answer.
 */
export function UseDefaultPlatformDefinition({ namespace = 'apps', onApplied, toast }: {
  namespace?: string
  onApplied?: (definition: PlatformDefinition) => void
  toast: Toast
}) {
  const [pending, setPending] = useState(false)

  const apply = async () => {
    setPending(true)
    try {
      const nodes = await api.platformNodes()
      const name = namespace.trim().toLowerCase() || 'apps'
      // Preflight refuses a node whose available CPU, memory and disk were
      // never measured, and only the host probe measures them. Saying that
      // here is the difference between one clear next step and a manifest
      // finding an operator has to translate back into "install the probe".
      const unmeasured = nodes.filter((node) => !node.availableCPUCores || !node.availableMemoryMiB || !node.availableDiskGiB)
      if (unmeasured.length) {
        toast({
          duration: 0,
          message: `${unmeasured.map((node) => node.name).join(', ')} reported no available capacity, and a definition cannot budget against an unmeasured node. Install the node inventory agent on Platform → Metrics, traces & logs, then use this again — or, if this install should have no manifest at all, declare it manifest-free on Platform definition.`,
          tone: 'danger',
        })
        return
      }
      const definition = await api.savePlatform({
        confirmation: '',
        manifest: defaultPlatformManifest(name, nodes),
        mode: 'manifest',
        namespace: name,
      })
      toast({ message: `This controller now admits deployments into the ${name} namespace. The first deployment declares its own slot.`, tone: 'success' })
      onApplied?.(definition)
    } catch (reason) {
      // The controller refuses a definition its own preflight rejects, and the
      // usual reason is a node whose available capacity was never measured.
      // That message is the useful one, so it is shown rather than a generic
      // failure.
      toast({ duration: 0, message: messageOf(reason), tone: 'danger' })
    } finally {
      setPending(false)
    }
  }

  return (
    <Button disabled={pending} loading={pending} onClick={() => void apply()} size="sm" variant="accent">
      Use the default definition
    </Button>
  )
}
