import { useState } from 'react'
import { Body, Button, Inline, useToast } from '@nim.zone/ui'
import { api } from '../data/api'
import type { Node } from '../data/types'
import { messageOf } from '../lib/errors'
import { shortID } from '../lib/format'

type Toast = ReturnType<typeof useToast>

export const STATEFUL_LABEL = 'nim.stateful'

const schedulable = (node: Node) => node.state === 'ready' && node.availability === 'active'
const labelled = (node: Node) => node.labels?.[STATEFUL_LABEL] === 'true'

/** Nodes that can actually hold a singleton's volume right now. */
export function statefulPlacementReady(nodes: Node[]) {
  return nodes.some((node) => schedulable(node) && labelled(node))
}

/**
 * The node the console would label if the operator does not want to choose.
 *
 * The reference topology in docs/swarm-platform.md puts `nim.stateful` on the
 * node that already carries the control plane, because a singleton's volume
 * and the state that has to survive with it belong on the same machine. That
 * preference is the ranking here; free disk decides between equals, and the
 * hostname breaks the remaining tie so the same cluster always yields the same
 * suggestion rather than whichever node the snapshot listed first.
 */
export function statefulCandidate(nodes: Node[]): Node | undefined {
  const rank = (node: Node) => (node.labels?.['nim.control'] === 'true' ? 2 : node.labels?.['nim.edge'] === 'true' ? 1 : 0)
  return nodes
    .filter((node) => schedulable(node) && !labelled(node))
    .sort((left, right) => rank(right) - rank(left) || right.disk.available - left.disk.available || left.hostname.localeCompare(right.hostname))[0]
}

/**
 * The blocker's own fix, next to the blocker.
 *
 * Every screen that reported "no node carries nim.stateful=true" sent the
 * operator to the Swarm screen to select a node, open its labels, and type a
 * key and a value that this console already knows. The choice is only worth
 * making by hand when the operator has a reason to override the ranking above,
 * so the suggestion is one button and the manual route stays beside it.
 */
export function AssignStatefulPlacement({ nodes, onOpenSwarm, toast }: {
  nodes: Node[]
  onOpenSwarm: () => void
  toast: Toast
}) {
  const [pending, setPending] = useState(false)
  const candidate = statefulCandidate(nodes)

  const assign = async () => {
    if (!candidate) return
    setPending(true)
    try {
      const command = await api.setNodeLabel(candidate.id, STATEFUL_LABEL, 'true')
      toast({ message: `${STATEFUL_LABEL}=true queued for ${candidate.hostname} (${shortID(command.id)})`, tone: 'success' })
    } catch (reason) {
      toast({ duration: 0, message: messageOf(reason), tone: 'danger' })
    } finally {
      setPending(false)
    }
  }

  return (
    <Inline gap="tight">
      {candidate ? (
        <Button disabled={pending} loading={pending} onClick={() => void assign()} size="sm" variant="accent">
          Label {candidate.hostname} {STATEFUL_LABEL}=true
        </Button>
      ) : (
        <Body size="sm">No ready, active node is available to label. Bring a node back to ready and active first.</Body>
      )}
      <Button onClick={onOpenSwarm} size="sm" variant="secondary">Choose a different node</Button>
    </Inline>
  )
}
