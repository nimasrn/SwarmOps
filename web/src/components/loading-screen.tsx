import { Panel, Spinner } from '@nim.zone/ui'
import { SwarmOpsMark } from './brand'

/**
 * The screen before there is a screen.
 *
 * It says what is being read rather than "Loading", because the two waits an
 * operator experiences here are completely different: reading the controller's
 * authority is a fast local answer, and reading a selected cluster is a
 * round trip through an agent that may be the thing that is broken.
 */
export function LoadingScreen({ label }: { label: string }) {
  return (
    <main aria-live="polite" className="swarmops-loading">
      <SwarmOpsMark size={52} />
      <Spinner label={label} size="lg" />
      <p>{label}</p>
    </main>
  )
}

/**
 * The same wait, inside the workspace.
 *
 * `LoadingScreen` is a full-viewport surface for the two moments before the
 * shell exists. Using it for a screen's own load centred a spinner in the whole
 * page and threw away the navigation the operator was reading — so a workspace
 * wait keeps the chrome and says what it is waiting for.
 */
export function WorkspaceLoading({ label }: { label: string }) {
  return (
    <Panel>
      <Spinner label={label} />
    </Panel>
  )
}
