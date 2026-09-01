import {Box, Text, useApp, useInput, useStdout} from 'ink'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'

import type {DiagnosticContext, DiagnosticReport} from '@/features/doctor/types.js'
import type {RunTaskInput} from '@/features/tasks/run-task.js'
import type {Task, TaskResult} from '@/features/tasks/types.js'
import type {Workspace} from '@/features/workspace/types.js'
import {ThemeProvider} from '@/providers/theme-provider.js'
import {Header} from '@/tui/components/app/header.js'
import {AppShell} from '@/tui/components/ui/app-shell.js'
import {CommandPalette, type Command} from '@/tui/components/ui/command-palette.js'
import {useTheme} from '@/tui/hooks/use-theme.js'
import {useUnicode} from '@/tui/hooks/use-unicode.js'
import {cliTheme} from '@/tui/theme/index.js'

import {isControlC, isHelpKey, isPaletteKey} from './keymap.js'
import {normalizeRoute, Router, type InitialRoute, type ScreenRoute} from './router.js'
import {HelpScreen} from './screens/help.js'
import type {RecentRun} from './screens/home.js'
import type {TaskActivity} from './screens/task-run.js'

export interface TuiServices {
  readonly listTasks: (workspace: Workspace) => Promise<readonly Task[]>
  readonly readWorkspace: (directory: string) => Promise<Workspace>
  readonly runDiagnostics: (context: DiagnosticContext) => Promise<DiagnosticReport>
  readonly runTask: (input: RunTaskInput) => Promise<TaskResult>
}

export interface AppProps {
  readonly cwd?: string
  readonly initialRoute?: InitialRoute
  readonly initialTask?: string
  readonly name?: string
  readonly onDiagnosticsCompleted?: (report: DiagnosticReport) => void
  readonly onExit?: (code: number) => void
  readonly onTaskCompleted?: (result: TaskResult) => void
  readonly services: TuiServices
  readonly stdinIsTTY?: boolean
  readonly stdoutIsTTY?: boolean
  readonly version?: string
}

interface AppContentProps extends Required<Pick<AppProps, 'cwd' | 'name' | 'version'>> {
  readonly initialRoute?: InitialRoute
  readonly initialTask?: string
  readonly onDiagnosticsCompleted?: (report: DiagnosticReport) => void
  readonly onExit?: (code: number) => void
  readonly onTaskCompleted?: (result: TaskResult) => void
  readonly services: TuiServices
  readonly stdinIsTTY: boolean
  readonly stdoutIsTTY: boolean
}

function AppContent({
  cwd,
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
  const {stdout} = useStdout()
  const theme = useTheme()
  const unicode = useUnicode()
  const [columns, setColumns] = useState(stdout.columns ?? 80)
  const [rows, setRows] = useState(stdout.rows ?? 24)
  const [route, setRoute] = useState<ScreenRoute>(() => normalizeRoute(initialRoute, initialTask))
  const previousRoute = useRef<ScreenRoute>({screen: 'home'})
  const activity = useRef<TaskActivity>({running: false})
  const [isTaskRunning, setIsTaskRunning] = useState(false)
  const [helpOverlayOpen, setHelpOverlayOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [workspace, setWorkspace] = useState<Workspace>()
  const [workspaceError, setWorkspaceError] = useState<string>()
  const [workspaceLoading, setWorkspaceLoading] = useState(true)
  const [tasks, setTasks] = useState<readonly Task[]>([])
  const [recentRuns, setRecentRuns] = useState<readonly RecentRun[]>([])

  useEffect(() => {
    const resize = () => {
      setColumns(stdout.columns ?? 80)
      setRows(stdout.rows ?? 24)
    }
    stdout.on('resize', resize)
    return () => {
      stdout.off('resize', resize)
    }
  }, [stdout])

  useEffect(() => {
    let active = true
    setWorkspaceLoading(true)
    setWorkspaceError(undefined)

    void services
      .readWorkspace(cwd)
      .then(async (nextWorkspace) => {
        const nextTasks = await services.listTasks(nextWorkspace)
        if (active) {
          setWorkspace(nextWorkspace)
          setTasks(nextTasks)
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setWorkspace(undefined)
          setTasks([])
          setWorkspaceError(caught instanceof Error ? caught.message : String(caught))
        }
      })
      .finally(() => {
        if (active) {
          setWorkspaceLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [cwd, services])

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
  const wide = columns >= 110
  const footerSeparator = unicode ? ' · ' : ' | '
  const footer = (
    wide
      ? [
          `${unicode ? '↑↓' : 'Up/Down'} navegar`,
          'Enter selecionar',
          'Tab alternar foco',
          '/ comandos',
          '? ajuda',
          'Esc voltar',
          `Ctrl+C ${isTaskRunning ? 'cancelar' : 'sair'}`,
        ]
      : [
          unicode ? '↑↓' : 'Up/Down',
          'Enter',
          'Tab',
          '/ ações',
          '? ajuda',
          'Esc',
          `Ctrl+C ${isTaskRunning ? 'cancelar' : 'sair'}`,
        ]
  ).join(footerSeparator)

  return (
    <AppShell fullscreen>
      <AppShell.Header>
        <Header
          cwd={cwd}
          isTaskRunning={isTaskRunning}
          name={name}
          version={version}
          workspace={workspace}
        />
      </AppShell.Header>

      <Box flexDirection="column" flexGrow={1} flexShrink={1} overflow="hidden" paddingX={1}>
        <Box
          display={paletteOpen || helpOverlayOpen ? 'none' : 'flex'}
          flexDirection="column"
          flexGrow={1}
          flexShrink={1}
          overflow="hidden"
        >
          <Router
            diagnosticContext={diagnosticContext}
            inputEnabled={!paletteOpen && !helpOverlayOpen}
            navigate={navigate}
            onDiagnosticsCompleted={onDiagnosticsCompleted}
            onTaskActivityChange={handleActivityChange}
            onTaskCompleted={handleTaskCompleted}
            recentRuns={recentRuns}
            route={route}
            services={services}
            tasks={tasks}
            viewportRows={rows}
            wide={wide}
            workspace={workspace}
            workspaceError={workspaceError}
            workspaceLoading={workspaceLoading}
          />
        </Box>
        {helpOverlayOpen ? (
          <HelpScreen viewportRows={rows} wide={wide} />
        ) : paletteOpen ? (
          <CommandPalette
            commands={commands}
            isOpen
            maxItems={Math.max(4, Math.min(10, rows - 10))}
            onClose={() => setPaletteOpen(false)}
            placeholder={unicode ? 'Buscar uma ação…' : 'Buscar uma ação...'}
          />
        ) : null}
      </Box>

      <AppShell.Hints>
        <Text color={theme.colors.mutedForeground}>{footer}</Text>
      </AppShell.Hints>
    </AppShell>
  )
}

export function App({
  cwd = process.cwd(),
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
