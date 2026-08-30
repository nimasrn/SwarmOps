import { useToast } from '@nim.zone/ui'
import { api } from '../../data/api'
import { useResource } from '../../data/hooks'
import { formatBytes } from '../../lib/format'
import { Screen } from '../../components/screen'
import type { WorkspacePage } from '../../navigation/navigation'
import { ContainersTab } from './resources/containers'

type Toast = ReturnType<typeof useToast>

/**
 * Everything running, on every host.
 *
 * This was one of six tabs on a screen called "Docker resources", where a
 * container sat beside a secret and a network on the grounds that Docker calls
 * them all objects. An operator does not go looking for "a Docker resource";
 * they go looking for the thing that is using the memory, and it is a
 * container. Volumes, networks, secrets and configs are storage, and they have
 * their own destination now.
 */
export function ContainersPage({ onOpen, toast }: { onOpen: (page: WorkspacePage) => void; toast: Toast }) {
  const usage = useResource(() => api.diskUsage(), [])
  const containers = usage.data?.Containers ?? []
  const running = containers.filter((container) => container.State === 'running').length
  const stopped = containers.length - running
  const reclaimable = containers
    .filter((container) => container.State !== 'running')
    .reduce((total, container) => total + (container.SizeRw ?? 0), 0)

  return (
    <Screen
      about="A container's environment is reduced to variable names on the way out of the controller. SwarmOps can tell you what a container was given; it will not read a value back out of Docker for a browser."
      insights={[
        {
          hint: 'Containers the Engine currently reports',
          icon: 'layers',
          label: 'Running',
          source: 'docker system df',
          unmeasured: !usage.data,
          value: String(running),
        },
        {
          hint: stopped ? 'Stopped, and still holding their writable layer' : 'Nothing is stopped',
          icon: 'stop',
          label: 'Stopped',
          source: 'docker system df',
          tone: stopped ? 'warning' : 'neutral',
          unmeasured: !usage.data,
          value: String(stopped),
        },
        {
          hint: 'Held by stopped containers, and reclaimable',
          icon: 'trash',
          label: 'Reclaimable',
          onOpen: () => onOpen('storage'),
          source: 'docker system df',
          unmeasured: !usage.data,
          value: formatBytes(reclaimable),
        },
        {
          hint: 'Each host reports its own containers every fifteen seconds',
          icon: 'server',
          label: 'Measured by',
          onOpen: () => onOpen('machines'),
          source: 'machine agents',
          value: 'The agents',
        },
      ]}
      page="containers"
      width="full"
    >
      <ContainersTab toast={toast} />
    </Screen>
  )
}
