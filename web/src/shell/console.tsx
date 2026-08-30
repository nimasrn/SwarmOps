import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AdminShell,
  Banner,
  Breadcrumb,
  Button,
  CommandPalette,
  ErrorBoundary,
  IconButton,
  Inline,
  Label,
  Menu,
  Select,
  StatusDot,
  useSchemeToggle,
  useToast,
} from '@nim.zone/ui'
import { api } from '../data/api'
import type { Server, Session } from '../data/types'
import { useAuditEvents, useCommands, useCoreTopology, useDashboard, useServers } from '../data/hooks'
import { attentionItems } from '../lib/attention'
import { formatClock } from '../lib/format'
import { serverCanManage } from '../lib/health'
import { readSession, writeSession } from '../lib/storage'
import { AREAS, areaOf, landingPage, pageEntry } from '../navigation/navigation'
import { useScreenMemory, useWorkspace } from '../navigation/use-workspace'
import { useShortcuts } from '../navigation/shortcuts'
import { paletteCommands, paletteEntities } from '../navigation/palette'
import { Brand } from '../components/brand'
import { AttentionMenu } from '../components/attention-menu'
import { ShortcutsSheet } from '../components/shortcuts-sheet'
import { PageRouter } from './page-router'

const SELECTED_SERVER_KEY = 'swarmops:selected-server'

/**
 * The console chrome: which cluster, which area, which screen, and everything
 * that has to stay reachable when the screen inside it fails.
 *
 * It owns exactly three things — the selected cluster, the current screen, and
 * the durable reads every screen shares. Anything that draws a screen lives
 * under `screens/`; anything that decides what a screen is called lives in
 * `navigation/`. This file is deliberately the only place that knows about all
 * three at once.
 */
export function Console({ onLogout, session }: { onLogout: () => void; session: Session }) {
  const [workspace, setWorkspace] = useWorkspace()
  const toast = useToast()
  const toggleScheme = useSchemeToggle()

  const { error: serversError, loading: serversLoading, refresh: refreshServers, servers } = useServers(onLogout)
  const { error: auditError, events: auditEvents, initialLoading: auditInitialLoading, refresh: refreshAudit, refreshing: auditRefreshing } = useAuditEvents(workspace === 'audit', onLogout)
  const watchingQueue = workspace === 'commands' || workspace === 'catalogue' || workspace === 'overview' || workspace === 'nodes'
  const { commands, error: commandsError, initialLoading: commandsInitialLoading, refresh: refreshCommands, refreshing: commandsRefreshing } = useCommands(
    watchingQueue ? 5_000 : 30_000,
    onLogout,
  )
  const { core, error: coreError, refresh: refreshCore } = useCoreTopology(onLogout)

  const [highlightedCommandID, setHighlightedCommandID] = useState('')
  const [activeServerID, setActiveServerID] = useState(() => readSession(SELECTED_SERVER_KEY) ?? '')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  // Selection is operator intent, not a health result. Keep the explicit target
  // while its agent reconnects so a transient poll cannot throw the operator
  // back to the first-run screen or silently select a different cluster.
  const activeServer = servers.find((server) => server.id === activeServerID)
  const managers = servers.filter((server) => serverCanManage(server) || server.id === activeServerID)
  const { data, error, refresh, refreshing } = useDashboard(activeServer?.id ?? '', onLogout)

  const selectServer = useCallback((id: string) => {
    api.selectServer(id)
    setActiveServerID(id)
    writeSession(SELECTED_SERVER_KEY, id)
  }, [])

  useEffect(() => {
    if (serversLoading) return
    const next = servers.some((server) => server.id === activeServerID)
      ? activeServerID
      : servers.find(serverCanManage)?.id ?? ''
    selectServer(next)
  }, [activeServerID, selectServer, servers, serversLoading])

  const connected = async (server: Server) => {
    await refreshServers()
    if (server.swarmControlAvailable) {
      selectServer(server.id)
      setWorkspace('overview')
      toast({ message: `${server.name} connected`, tone: 'success' })
      return
    }
    setWorkspace('provisioning')
    toast({
      message: server.dockerAvailable
        ? `${server.name} is connected. Complete server readiness before using cluster operations.`
        : `${server.name} is connected through its machine API. Choose its readiness plan next.`,
      tone: 'accent',
    })
  }

  const signOut = async () => {
    try {
      await api.logout()
    } catch {
      // Removing the local session is safer than leaving a failed sign-out
      // screen usable; the server-side cookie expires independently.
    }
    selectServer('')
    onLogout()
  }

  const area = areaOf(workspace)
  const page = pageEntry(workspace)
  const { isPinned, pinned, recents, togglePin } = useScreenMemory(workspace)
  const attention = attentionItems(core, data ?? undefined, servers, commands)

  // The rail is the operator's JOB — deliver, fleet, workloads, traffic,
  // observe, activity, control — and every area opens on the screen that
  // answers its first question. Building both tiers from one source is why
  // `agent-diagnostics` is now reachable: a screen that exists but appears in
  // no group is a screen only its own author can find.
  const areaGroups = useMemo(() => [{
    key: 'areas',
    label: '',
    items: AREAS.map((entry) => ({
      icon: entry.icon,
      key: entry.key,
      label: entry.label,
      onSelect: () => setWorkspace(landingPage(entry)),
    })),
  }], [setWorkspace])

  // Two groups in the second tier: the area's own screens, and — above them,
  // only when someone has pinned any — the handful they have decided matter.
  // A console with twenty-four screens has, for any one person, about five.
  const contextualGroups = useMemo(() => [
    ...(pinned.length ? [{
      key: 'pinned',
      label: 'Pinned',
      items: pinned.map((key) => ({
        icon: pageEntry(key).icon,
        key: `pinned-${key}`,
        label: pageEntry(key).label,
        onSelect: () => setWorkspace(key),
      })),
    }] : []),
    {
      key: area.key,
      label: pinned.length ? area.label : '',
      items: area.pages.map((entry) => ({
        icon: entry.icon,
        key: entry.key,
        label: entry.label,
        onSelect: () => setWorkspace(entry.key),
      })),
    },
  ], [area, pinned, setWorkspace])

  const refreshAction = workspace === 'audit'
    ? refreshAudit
    : workspace === 'commands'
      ? refreshCommands
      : workspace === 'core'
        ? refreshCore
        : workspace === 'servers' || workspace === 'agent-diagnostics' || !activeServer
          ? refreshServers
          : refresh
  const refreshLoading = workspace === 'audit'
    ? auditInitialLoading || auditRefreshing
    : workspace === 'commands'
      ? commandsInitialLoading || commandsRefreshing
      : workspace === 'servers' || workspace === 'agent-diagnostics' || !activeServer
        ? serversLoading
        : refreshing
  const refreshLabel = workspace === 'audit'
    ? 'Refresh audit trail'
    : workspace === 'commands'
      ? 'Refresh command queue'
      : workspace === 'servers' || workspace === 'agent-diagnostics'
        ? 'Refresh servers'
        : activeServer
          ? 'Refresh cluster snapshot'
          : 'Refresh server profiles'

  useShortcuts({
    onDiagnostics: () => setWorkspace('agent-diagnostics'),
    onHelp: () => setShortcutsOpen(true),
    onOpen: setWorkspace,
    onPalette: () => setPaletteOpen(true),
    onRefresh: () => void refreshAction(),
  })

  const entities = useMemo(
    () => paletteEntities({ servers, services: data?.services ?? [], stacks: data?.stacks ?? [] }),
    [data?.services, data?.stacks, servers],
  )

  const palette = useMemo(() => paletteCommands({
    entities,
    managers,
    onRefresh: () => void refreshAction(),
    onSelectServer: selectServer,
    onShortcuts: () => setShortcutsOpen(true),
    onSignOut: () => void signOut(),
    open: setWorkspace,
    recents,
    refreshLabel,
    selectedServerID: activeServerID,
  }), [activeServerID, entities, managers, recents, refreshAction, refreshLabel, selectServer, setWorkspace])

  const agentTone = activeServer?.connectionState === 'connected' ? 'success' : activeServer ? 'warning' : 'neutral'
  const agentLabel = activeServer?.connectionState === 'connected' ? 'Agent connected' : activeServer ? 'Agent reconnecting' : 'No target selected'

  return (
    <AdminShell
      brand={<Brand subtitle="" />}
      contextualFooter={
        <>
          {/* Observed scope only: what this console currently has authority
              over and how fresh the last read of it is. An assurance claim
              would be an unverified one, and this is the chrome an operator
              looks at when deciding whether to believe the screen. */}
          <StatusDot tone={!core ? 'neutral' : core.controlEnabled ? 'success' : 'warning'}>
            {!core ? 'Controller checking' : core.controlEnabled ? 'Controller holds authority' : 'Controller on standby'}
          </StatusDot>
          <span>
            {activeServer
              ? data
                ? `Snapshot of ${activeServer.name} read at ${formatClock(data.overview.generatedAt)}.`
                : `${activeServer.name} selected; no cluster snapshot has been read yet.`
              : 'No cluster is selected, so nothing on this screen is a claim about production.'}
          </span>
        </>
      }
      contextualGroups={contextualGroups}
      contextualHeader={
        <>
          <Label>{area.label}</Label>
          <strong>{page.label}</strong>
          <span>{area.summary}</span>
        </>
      }
      contextualValue={workspace}
      groups={areaGroups}
      navigation="rail"
      title={
        // The target and the evidence that it is reachable belong in the same
        // control. Before this the selector sat in the masthead and its
        // connection state sat in the sidebar footer, which asked the operator
        // to look in two places to answer one question.
        <Inline gap="tight" wrap={false}>
          <Label>Cluster</Label>
          {managers.length ? (
            <>
              <Select
                aria-label="Selected Docker Swarm cluster manager"
                onChange={(event) => event.target.value ? selectServer(event.target.value) : setWorkspace('servers')}
                options={managers.map((server) => ({ label: server.name, value: server.id }))}
                placeholder="Select a cluster"
                value={activeServerID}
              />
              <StatusDot pulse={agentTone === 'warning'} tone={agentTone}>{agentLabel}</StatusDot>
            </>
          ) : (
            <Button iconStart="plus" onClick={() => setWorkspace('servers')} size="sm" variant="secondary">Connect a server</Button>
          )}
        </Inline>
      }
      titleRole="scope"
      toolbar={
        <>
          <AttentionMenu items={attention} onOpen={setWorkspace} />
          <Button iconStart="search" onClick={() => setPaletteOpen(true)} size="sm" variant="secondary">
            Search or run…  ⌘K
          </Button>
          <IconButton disabled={refreshLoading} label={refreshLabel} name="refresh" onClick={() => void refreshAction()} size="sm" variant="ghost" />
          <Menu
            items={[
              { kind: 'heading', label: session.user.username },
              { icon: isPinned(workspace) ? 'star' : 'pin', label: isPinned(workspace) ? `Unpin ${page.label}` : `Pin ${page.label}`, onSelect: () => togglePin(workspace) },
              { icon: 'sun', label: 'Switch light or dark', onSelect: toggleScheme },
              { icon: 'sparkle', label: 'Keyboard shortcuts', onSelect: () => setShortcutsOpen(true) },
              { kind: 'separator' },
              { icon: 'settings', label: 'Controller & recovery', onSelect: () => setWorkspace('core') },
              { icon: 'shield', label: 'Audit trail', onSelect: () => setWorkspace('audit') },
              { icon: 'link', label: 'Connection diagnostics', onSelect: () => setWorkspace('agent-diagnostics') },
              { kind: 'separator' },
              { icon: 'sign-out', label: 'Sign out', onSelect: () => void signOut() },
            ]}
            label={`Operator ${session.user.username}`}
          >
            {({ ref, toggle }) => (
              <IconButton label={`Operator ${session.user.username}`} name="user" onClick={toggle} ref={ref} size="sm" variant="ghost" />
            )}
          </Menu>
        </>
      }
      value={area.key}
    >
      <CommandPalette
        commands={palette}
        emptyLabel={(query) => `No screen, cluster object, or action matches “${query}”.`}
        label="Search screens or run an action"
        onClose={() => setPaletteOpen(false)}
        open={paletteOpen}
        placeholder="Search screens, servers, services, or run an action…"
      />
      <ShortcutsSheet onClose={() => setShortcutsOpen(false)} open={shortcutsOpen} />

      {/* Two tiers of navigation still leave "where am I" unanswered on a
          console with twenty-four screens; the crumb answers it in one line
          and gives the area back as a target. */}
      {workspace === 'overview' ? null : (
        <Breadcrumb
          items={[
            { href: `#${landingPage(area)}`, label: area.label },
            { label: page.label },
          ]}
        />
      )}
      {serversError ? <Banner title="Server list unavailable" tone="danger">{serversError}</Banner> : null}

      {/* The workspace, not the shell. React unmounts from the root when a
          render throws and nothing catches it, so a screen that failed used to
          take the navigation rail with it and leave an operator on a blank
          page with no way back. The chrome that lets someone leave a broken
          screen has to survive it.

          resetKey is the workspace, so navigating away clears the wreckage
          rather than stranding the reader on it. */}
      <ErrorBoundary resetKey={workspace}>
        <PageRouter
          activeServer={activeServer}
          auditError={auditError}
          auditEvents={auditEvents}
          auditInitialLoading={auditInitialLoading}
          clusterError={error}
          commands={commands}
          commandsError={commandsError}
          commandsInitialLoading={commandsInitialLoading}
          core={core}
          coreError={coreError}
          data={data}
          highlightedCommandID={highlightedCommandID}
          onConnected={connected}
          onHighlightCommand={setHighlightedCommandID}
          onOpen={setWorkspace}
          onRefreshCommands={refreshCommands}
          onRefreshServers={refreshServers}
          onSelectServer={selectServer}
          serversLoading={serversLoading}
          servers={servers}
          toast={toast}
          workspace={workspace}
        />
      </ErrorBoundary>
    </AdminShell>
  )
}
