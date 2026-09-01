import {Box, Text} from 'ink'

import type {Task, TaskStatus} from '@/features/tasks/index.js'
import type {Workspace} from '@/features/workspace/index.js'
import {EmptyState} from '@/tui/components/app/empty-state.js'
import {Panel} from '@/tui/components/app/panel.js'
import {ScreenTitle} from '@/tui/components/app/screen-title.js'
import {Menu, type MenuItem} from '@/tui/components/ui/menu.js'
import {StatusMessage} from '@/tui/components/ui/status-message.js'
import {Table, type Column} from '@/tui/components/ui/table.js'
import {useTheme} from '@/tui/hooks/use-theme.js'
import {useUnicode} from '@/tui/hooks/use-unicode.js'

import type {ScreenRoute} from '../routes.js'

export interface RecentRun {
  readonly durationMs: number
  readonly status: TaskStatus
  readonly taskName: string
}

export interface HomeScreenProps {
  readonly error?: string
  readonly inputEnabled: boolean
  readonly loading: boolean
  readonly navigate: (route: ScreenRoute) => void
  readonly recentRuns: readonly RecentRun[]
  readonly tasks: readonly Task[]
  readonly viewportRows: number
  readonly wide: boolean
  readonly workspace?: Workspace
}

type RecentRunRow = Record<'duration' | 'status' | 'task', string>

const recentColumns: Column<RecentRunRow>[] = [
  {header: 'Tarefa', key: 'task', width: 18},
  {header: 'Status', key: 'status', width: 11},
  {align: 'right', header: 'Duração', key: 'duration', width: 9},
]

const formatDuration = (durationMs: number): string => {
  if (durationMs < 1000) {
    return `${durationMs} ms`
  }

  return `${(durationMs / 1000).toFixed(1)} s`
}

export function HomeScreen({
  error,
  inputEnabled,
  loading,
  navigate,
  recentRuns,
  tasks,
  viewportRows,
  wide,
  workspace,
}: HomeScreenProps) {
  const theme = useTheme()
  const unicode = useUnicode()
  const firstTask = tasks[0]
  const showHistory = wide || viewportRows >= 35
  const actions: MenuItem[] = [
    {key: 'tasks', label: 'Explorar tarefas', shortcut: 'Enter'},
    {
      disabled: !firstTask,
      key: 'run',
      label: firstTask ? `Executar ${firstTask.name}` : 'Executar uma tarefa',
    },
    {key: 'doctor', label: 'Verificar ambiente'},
    {key: 'help', label: 'Ver atalhos', shortcut: '?'},
  ]

  const selectAction = (item: MenuItem) => {
    switch (item.key) {
      case 'tasks': {
        navigate({screen: 'task-list'})
        break
      }
      case 'run': {
        if (firstTask) {
          navigate({screen: 'task-run', taskName: firstTask.name})
        }

        break
      }
      case 'doctor': {
        navigate({screen: 'doctor'})
        break
      }
      case 'help': {
        navigate({screen: 'help'})
        break
      }
    }
  }

  const summary = (
    <Panel title="Workspace">
      {loading ? (
        <StatusMessage variant="loading">
          {unicode ? 'Lendo package.json…' : 'Lendo package.json...'}
        </StatusMessage>
      ) : null}
      {!loading && workspace ? (
        <Box flexDirection="column">
          <Text>
            Pacote: <Text bold>{workspace.name}</Text>
          </Text>
          <Text>
            Scripts: <Text color={theme.colors.accent}>{tasks.length}</Text>
          </Text>
          <Text color={theme.colors.mutedForeground} wrap="truncate-middle">
            {workspace.packageJsonPath}
          </Text>
          {!showHistory ? (
            <Text color={theme.colors.mutedForeground} wrap="truncate-end">
              Sessão:{' '}
              {recentRuns[0]
                ? `${recentRuns[0].taskName} (${recentRuns[0].status})`
                : 'nenhuma execução'}
            </Text>
          ) : null}
        </Box>
      ) : null}
      {!loading && !workspace ? (
        <EmptyState
          detail={error ?? 'Execute a CLI dentro de um projeto Node.js.'}
          title="Nenhum package.json encontrado"
        />
      ) : null}
    </Panel>
  )

  const historyRows: RecentRunRow[] = recentRuns.slice(0, 5).map((run) => ({
    duration: formatDuration(run.durationMs),
    status: run.status,
    task: run.taskName,
  }))

  const history = (
    <Panel title="Execuções nesta sessão">
      {historyRows.length > 0 ? (
        <Table columns={recentColumns} data={historyRows} maxRows={5} />
      ) : (
        <Text color={theme.colors.mutedForeground}>As tarefas executadas aparecerão aqui.</Text>
      )}
    </Panel>
  )

  return (
    <Box flexDirection="column">
      <ScreenTitle description="Ações rápidas e visão geral do projeto atual." title="Início" />
      <Box flexDirection={wide ? 'row' : 'column'} gap={1}>
        <Box flexDirection="column" gap={1} width={wide ? 38 : undefined}>
          <Menu
            aria-label="Ações rápidas"
            autoFocus
            isActive={inputEnabled}
            items={actions}
            onSelect={selectAction}
            title="Ações rápidas"
          />
          {summary}
        </Box>
        {showHistory ? <Box flexGrow={1}>{history}</Box> : null}
      </Box>
    </Box>
  )
}
