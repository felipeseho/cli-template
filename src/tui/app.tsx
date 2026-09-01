import {Text, useApp, useInput, useWindowSize} from 'ink'
import {useCallback, useMemo, useRef, useState} from 'react'

import type {DiagnosticContext, DiagnosticReport} from '@/features/doctor/index.js'
import type {TaskResult} from '@/features/tasks/index.js'
import type {TaskActivity} from '@/features/tasks/tui/use-task-run.js'
import {useWorkspace} from '@/features/workspace/tui/use-workspace.js'
import {ThemeProvider} from '@/providers/theme-provider.js'
import type {ApplicationServices} from '@/runtime/services.js'
import {DashboardShell} from '@/tui/components/app/dashboard-shell.js'
import {Header} from '@/tui/components/app/header.js'
import {Alert} from '@/tui/components/ui/alert.js'
import {Breadcrumb, type BreadcrumbItem} from '@/tui/components/ui/breadcrumb.js'
import {CommandPalette, type Command} from '@/tui/components/ui/command-palette.js'
import {useTheme} from '@/tui/hooks/use-theme.js'
import {useUnicode} from '@/tui/hooks/use-unicode.js'
import {dashboardContentRows, resolveDashboardLayout} from '@/tui/layout.js'
import {cliTheme} from '@/tui/theme/index.js'

import {isControlC, isHelpKey, isPaletteKey} from './keymap.js'
import {Router} from './router.js'
import {normalizeRoute, routeBreadcrumbs, type InitialRoute, type ScreenRoute} from './routes.js'
import {HelpScreen} from './screens/help.js'
import type {RecentRun} from './screens/home.js'

export interface AppProps {
  readonly cwd?: string
  readonly description?: string
  readonly initialRoute?: InitialRoute
  readonly initialTask?: string
  readonly name?: string
  readonly onDiagnosticsCompleted?: (report: DiagnosticReport) => void
  readonly onExit?: (code: number) => void
  readonly onTaskCompleted?: (result: TaskResult) => void
  readonly services: ApplicationServices
  readonly stdinIsTTY?: boolean
  readonly stdoutIsTTY?: boolean
  readonly version?: string
}

interface AppContentProps extends Required<
  Pick<AppProps, 'cwd' | 'description' | 'name' | 'version'>
> {
  readonly initialRoute?: InitialRoute
  readonly initialTask?: string
  readonly onDiagnosticsCompleted?: (report: DiagnosticReport) => void
  readonly onExit?: (code: number) => void
  readonly onTaskCompleted?: (result: TaskResult) => void
  readonly services: ApplicationServices
  readonly stdinIsTTY: boolean
  readonly stdoutIsTTY: boolean
}

function AppContent({
  cwd,
  description,
  initialRoute,
  initialTask,
  name,
  onDiagnosticsCompleted,
  onExit,
  onTaskCompleted,
  services,
  stdinIsTTY,
  stdoutIsTTY,
  version,
}: AppContentProps) {
  const {exit} = useApp()
  const theme = useTheme()
  const unicode = useUnicode()
  const {columns, rows} = useWindowSize()
  const layout = resolveDashboardLayout({columns, rows})
  const [route, setRoute] = useState<ScreenRoute>(() => normalizeRoute(initialRoute, initialTask))
  const previousRoute = useRef<ScreenRoute>({screen: 'home'})
  const activity = useRef<TaskActivity>({running: false})
  const [isTaskRunning, setIsTaskRunning] = useState(false)
  const [helpOverlayOpen, setHelpOverlayOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [lastDiagnosticReport, setLastDiagnosticReport] = useState<DiagnosticReport>()
  const listTasks = useCallback<ApplicationServices['listTasks']>(
    (workspace) => services.listTasks(workspace),
    [services],
  )
  const readWorkspace = useCallback<ApplicationServices['readWorkspace']>(
    (directory) => services.readWorkspace(directory),
    [services],
  )
  const {
    error: workspaceError,
    loading: workspaceLoading,
    workspace,
  } = useWorkspace({
    cwd,
    readWorkspace,
  })
  const tasks = useMemo(() => (workspace ? listTasks(workspace) : []), [listTasks, workspace])
  const [recentRuns, setRecentRuns] = useState<readonly RecentRun[]>([])

  const requestExit = useCallback(
    (code: number) => {
      onExit?.(code)
      exit(code)
    },
    [exit, onExit],
  )

  const navigate = useCallback(
    (nextRoute: ScreenRoute) => {
      if (activity.current.running && nextRoute.screen !== 'task-run') {
        return
      }

      if (nextRoute.screen === 'help' && route.screen !== 'help') {
        previousRoute.current = route
      }

      setHelpOverlayOpen(false)
      setPaletteOpen(false)
      setDialogOpen(false)
      setRoute(nextRoute)
    },
    [route],
  )

  const handleActivityChange = useCallback((nextActivity: TaskActivity) => {
    activity.current = nextActivity
    setIsTaskRunning(nextActivity.running)
  }, [])

  const handleTaskCompleted = useCallback(
    (result: TaskResult) => {
      setRecentRuns((current) =>
        [
          {
            durationMs: result.durationMs,
            status: result.status,
            taskName: result.task.name,
          },
          ...current,
        ].slice(0, 5),
      )
      onTaskCompleted?.(result)
    },
    [onTaskCompleted],
  )

  const handleDiagnosticsCompleted = useCallback(
    (report: DiagnosticReport) => {
      setLastDiagnosticReport(report)
      onDiagnosticsCompleted?.(report)
    },
    [onDiagnosticsCompleted],
  )

  const handleBack = useCallback(() => {
    switch (route.screen) {
      case 'home': {
        requestExit(0)
        break
      }
      case 'help': {
        setRoute(previousRoute.current)
        break
      }
      case 'task-run': {
        setRoute({screen: 'task-list'})
        break
      }
      default: {
        setRoute({screen: 'home'})
      }
    }
  }, [requestExit, route.screen])

  useInput((input, key) => {
    if (isControlC(input, key)) {
      if (activity.current.running) {
        activity.current.cancel()
      } else {
        requestExit(130)
      }

      return
    }

    if (dialogOpen) {
      // The topmost Dialog owns keyboard interaction. In particular, Escape
      // must close the dialog rather than trigger route-level back navigation.
      return
    }

    if (paletteOpen) {
      // CommandPalette's FocusScope exclusively owns Escape while open. The
      // global back action must not observe the same keypress.
      return
    }

    if (helpOverlayOpen) {
      if (key.escape || isHelpKey(input, key)) {
        setHelpOverlayOpen(false)
      }

      return
    }

    if (isPaletteKey(input, key)) {
      setPaletteOpen(true)
      return
    }

    if (isHelpKey(input, key)) {
      if (activity.current.running) {
        setHelpOverlayOpen(true)
        return
      }

      if (route.screen === 'help') {
        setRoute(previousRoute.current)
      } else {
        previousRoute.current = route
        setRoute({screen: 'help'})
      }

      return
    }

    if (!key.escape || activity.current.running) {
      return
    }

    handleBack()
  })

  const commands = useMemo<Command[]>(
    () => [
      {
        disabled: isTaskRunning,
        group: 'Navegação',
        id: 'home',
        label: 'Ir para o início',
        onSelect: () => navigate({screen: 'home'}),
      },
      {
        disabled: isTaskRunning,
        group: 'Navegação',
        id: 'tasks',
        label: 'Listar tarefas',
        onSelect: () => navigate({screen: 'task-list'}),
      },
      {
        disabled: isTaskRunning,
        group: 'Navegação',
        id: 'doctor',
        label: 'Executar doctor',
        onSelect: () => navigate({screen: 'doctor'}),
      },
      {
        disabled: isTaskRunning,
        group: 'Navegação',
        id: 'help',
        label: 'Mostrar ajuda',
        onSelect: () => navigate({screen: 'help'}),
        shortcut: '?',
      },
      ...tasks.map<Command>((task) => ({
        description: task.command,
        disabled: isTaskRunning,
        group: 'Tarefas',
        id: `run-${task.name}`,
        label: `Executar ${task.name}`,
        onSelect: () => navigate({screen: 'task-run', taskName: task.name}),
      })),
    ],
    [isTaskRunning, navigate, tasks],
  )

  const diagnosticContext = useMemo<DiagnosticContext>(
    () => ({cwd, stdinIsTTY, stdoutIsTTY}),
    [cwd, stdinIsTTY, stdoutIsTTY],
  )
  const wide = layout === 'wide'
  const viewportRows = dashboardContentRows(rows)
  const routeTrail = routeBreadcrumbs(route)
  const breadcrumbItems = useMemo<readonly BreadcrumbItem[]>(
    () =>
      routeTrail.map((entry, index) => ({
        id: `${index}-${entry.route.screen}`,
        label: entry.label,
        ...(index < routeTrail.length - 1 ? {onSelect: () => navigate(entry.route)} : {}),
      })),
    [navigate, routeTrail],
  )
  const headerStatus = isTaskRunning
    ? ('running' as const)
    : workspaceLoading
      ? ('loading' as const)
      : workspaceError
        ? ('warning' as const)
        : ('ready' as const)
  const footerSeparator = unicode ? ' · ' : ' | '
  const navigationHint = wide ? `${unicode ? '↑↓' : 'Up/Down'} navegar` : unicode ? '↑↓' : 'Up/Down'
  const routeFooterItems = (() => {
    switch (route.screen) {
      case 'doctor': {
        return wide
          ? [
              'R repetir diagnóstico',
              'Tab alternar foco',
              '/ comandos',
              '? ajuda',
              'Esc voltar',
              'Ctrl+C sair',
            ]
          : ['R repetir', 'Tab', '/ ações', '? ajuda', 'Esc', 'Ctrl+C sair']
      }
      case 'help': {
        return wide
          ? ['Tab alternar foco', '/ comandos', '? fechar ajuda', 'Esc voltar', 'Ctrl+C sair']
          : ['Tab', '/ ações', '? fechar', 'Esc', 'Ctrl+C sair']
      }
      case 'task-list': {
        return wide
          ? [
              'Digite para buscar',
              navigationHint,
              'Enter executar',
              'Tab alternar foco',
              '/ comandos',
              '? ajuda',
              'Esc voltar',
            ]
          : ['Buscar', navigationHint, 'Enter', 'Tab', '/ ações', '? ajuda', 'Esc', 'Ctrl+C']
      }
      case 'task-run': {
        if (isTaskRunning) {
          return wide
            ? [
                'J/K log',
                'F follow',
                'Tab alternar foco',
                '/ comandos',
                '? ajuda',
                'Ctrl+C cancelar',
              ]
            : ['J/K log', 'F follow', 'Tab', '/ ações', '? ajuda', 'Ctrl+C cancelar']
        }

        return wide
          ? [
              navigationHint,
              'Enter selecionar',
              'Tab alternar foco',
              '/ comandos',
              '? ajuda',
              'Esc voltar',
              'Ctrl+C sair',
            ]
          : [navigationHint, 'Enter', 'Tab', '/ ações', '? ajuda', 'Esc', 'Ctrl+C sair']
      }
      default: {
        return wide
          ? [
              navigationHint,
              'Enter selecionar',
              'Tab alternar foco',
              '/ comandos',
              '? ajuda',
              'Esc sair',
              'Ctrl+C sair',
            ]
          : [navigationHint, 'Enter', 'Tab', '/ ações', '? ajuda', 'Esc', 'Ctrl+C sair']
      }
    }
  })()
  const footerItems = dialogOpen
    ? [
        `${unicode ? '←/→' : 'Left/Right'} escolher`,
        'Enter/Y confirmar',
        'Esc/N voltar',
        'Ctrl+C sair',
      ]
    : helpOverlayOpen
      ? ['Tab alternar foco', '? ou Esc fechar', `Ctrl+C ${isTaskRunning ? 'cancelar' : 'sair'}`]
      : paletteOpen
        ? [
            'Digite para buscar',
            navigationHint,
            'Enter executar',
            'Esc fechar',
            `Ctrl+C ${isTaskRunning ? 'cancelar' : 'sair'}`,
          ]
        : routeFooterItems
  const footer = footerItems.join(footerSeparator)
  const overlay = helpOverlayOpen ? (
    <HelpScreen viewportRows={viewportRows} wide={wide} />
  ) : paletteOpen ? (
    <CommandPalette
      commands={commands}
      isOpen
      maxItems={Math.max(4, Math.min(10, viewportRows - 5))}
      onClose={() => setPaletteOpen(false)}
      placeholder={unicode ? 'Buscar uma ação…' : 'Buscar uma ação...'}
    />
  ) : undefined

  return (
    <DashboardShell
      alert={
        workspaceError ? (
          <Alert bordered={layout !== 'compact'} title="Workspace indisponível" variant="warning">
            <Text color={theme.colors.mutedForeground} wrap="truncate-end">
              {workspaceError}
            </Text>
          </Alert>
        ) : undefined
      }
      breadcrumb={
        <Breadcrumb
          aria-label="Navegação atual"
          currentIndex={breadcrumbItems.length - 1}
          id="dashboard-breadcrumb"
          isActive={!paletteOpen && !helpOverlayOpen && !dialogOpen}
          items={breadcrumbItems}
        />
      }
      footer={footer}
      header={
        <Header
          cwd={cwd}
          description={description}
          layout={layout}
          name={name}
          status={headerStatus}
          version={version}
          workspace={workspace}
        />
      }
      overlay={overlay}
    >
      <Router
        diagnosticContext={diagnosticContext}
        inputEnabled={!paletteOpen && !helpOverlayOpen && !dialogOpen}
        lastDiagnosticReport={lastDiagnosticReport}
        layout={layout}
        navigate={navigate}
        onDiagnosticsCompleted={handleDiagnosticsCompleted}
        onDialogOpenChange={setDialogOpen}
        onTaskActivityChange={handleActivityChange}
        onTaskCompleted={handleTaskCompleted}
        recentRuns={recentRuns}
        route={route}
        services={services}
        tasks={tasks}
        viewportRows={viewportRows}
        wide={wide}
        workspace={workspace}
        workspaceError={workspaceError}
        workspaceLoading={workspaceLoading}
      />
    </DashboardShell>
  )
}

export function App({
  cwd = process.cwd(),
  description = 'Automação, diagnósticos e tarefas do workspace.',
  initialRoute,
  initialTask,
  name = 'mycli',
  onDiagnosticsCompleted,
  onExit,
  onTaskCompleted,
  services,
  stdinIsTTY = process.stdin.isTTY === true,
  stdoutIsTTY = process.stdout.isTTY === true,
  version = '0.0.0',
}: AppProps) {
  return (
    <ThemeProvider theme={cliTheme}>
      <AppContent
        cwd={cwd}
        description={description}
        initialRoute={initialRoute}
        initialTask={initialTask}
        name={name}
        onDiagnosticsCompleted={onDiagnosticsCompleted}
        onExit={onExit}
        onTaskCompleted={onTaskCompleted}
        services={services}
        stdinIsTTY={stdinIsTTY}
        stdoutIsTTY={stdoutIsTTY}
        version={version}
      />
    </ThemeProvider>
  )
}
