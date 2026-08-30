import { useState } from 'react'
import { Segmented, useToast } from '@nim.zone/ui'
import type { DashboardData } from '../../data/dashboard'
import { Screen } from '../../components/screen'
import type { WorkspacePage } from '../../navigation/navigation'
import { ServicesTab } from './services'
import { StacksTab } from './stacks'

type Toast = ReturnType<typeof useToast>

type WorkloadTab = 'services' | 'stacks'

/**
 * The Swarm objects underneath an application.
 *
 * An application is the thing you own; a stack and a service are how Swarm
 * happens to run it. Those used to be an entire area of their own called
 * Workloads, which put the object model in the navigation and left an operator
 * to work out that "checkout-api" the application and "production_checkout"
 * the service were the same thing at two levels of abstraction.
 *
 * They are one destination now, and deliberately the last one in the area:
 * most of what an operator wants is on the application, and this is where you
 * go when it is not.
 */
export function WorkloadsPage({ data, onOpen, toast }: {
  data: DashboardData
  onOpen: (page: WorkspacePage) => void
  toast: Toast
}) {
  const [tab, setTab] = useState<WorkloadTab>('services')
  const services = data.services ?? []
  const stacks = data.stacks ?? []
  const degraded = services.filter((service) => service.runningTasks < service.desiredTasks).length

  return (
    <Screen
      about="A service here is the same object an application owns above. Changing one changes the other, which is why scaling and rollback are the same fixed, audited commands on both."
      insights={[
        {
          hint: `${stacks.length} ${stacks.length === 1 ? 'stack' : 'stacks'} across this cluster`,
          icon: 'terminal',
          label: 'Services',
          source: 'cluster snapshot',
          value: String(services.length),
        },
        {
          hint: degraded ? 'Running fewer tasks than they want' : 'Every service has the tasks it asked for',
          icon: degraded ? 'alert' : 'check-circle',
          label: 'Degraded',
          onOpen: degraded ? () => onOpen('swarm') : undefined,
          source: 'cluster snapshot',
          tone: degraded ? 'warning' : 'success',
          value: String(degraded),
        },
        {
          hint: 'The products these services belong to',
          icon: 'layers',
          label: 'Applications',
          onOpen: () => onOpen('applications'),
          source: 'controller state',
          value: 'Owned above',
        },
      ]}
      page="workloads"
      width="full"
    >
      <Segmented
        label="Workload kind"
        onChange={(value: string) => setTab(value as WorkloadTab)}
        options={[
          { label: `Services · ${services.length}`, value: 'services' },
          { label: `Stacks · ${stacks.length}`, value: 'stacks' },
        ]}
        value={tab}
      />
      {tab === 'services' ? (
        <ServicesTab
          onDiagnosisAction={(kind) => {
            // A diagnosis hands off to the screen that owns the action; it does
            // not perform it. Prune in particular is gated behind an explicit
            // confirmation, and a destructive command run from a panel that
            // just told you what was wrong would bypass exactly the
            // deliberation that gate exists to force.
            const destination: Partial<Record<string, WorkspacePage>> = {
              'edit-constraint': 'workloads',
              'label-node': 'swarm',
              logs: 'logs',
              prune: 'storage',
              reschedule: 'swarm',
            }
            const next = destination[kind]
            if (next) onOpen(next)
            else toast({ message: `No screen owns "${kind}" yet.`, tone: 'neutral' })
          }}
          onOpenLogs={() => onOpen('logs')}
          services={services}
          toast={toast}
        />
      ) : null}
      {tab === 'stacks' ? (
        <StacksTab
          nodes={data.nodes}
          onDeployFromSource={() => onOpen('deploy')}
          stacks={stacks}
          toast={toast}
        />
      ) : null}
    </Screen>
  )
}
