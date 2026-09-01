import {Box, Text} from 'ink'

import type {DiagnosticReport} from '@/features/doctor/index.js'
import type {Task, TaskStatus} from '@/features/tasks/index.js'
import type {Workspace} from '@/features/workspace/index.js'
import {MetricCard, type MetricTone} from '@/tui/components/app/metric-card.js'
import {Panel} from '@/tui/components/app/panel.js'
import {ScreenTitle} from '@/tui/components/app/screen-title.js'
import {Menu, type MenuItem} from '@/tui/components/ui/menu.js'
import {Table, type Column} from '@/tui/components/ui/table.js'
import {useTheme} from '@/tui/hooks/use-theme.js'
import {useUnicode} from '@/tui/hooks/use-unicode.js'
import type {DashboardLayout} from '@/tui/layout.js'

import type {ScreenRoute} from '../routes.js'

export interface RecentRun {
  readonly durationMs: number
  readonly status: TaskStatus
  readonly taskName: string
}

export interface HomeScreenProps {
  readonly error?: string
  readonly inputEnabled: boolean
  readonly lastDiagnosticReport?: DiagnosticReport
  readonly layout: DashboardLayout
  readonly loading: boolean
  readonly navigate: (route: ScreenRoute) => void
  readonly recentRuns: readonly RecentRun[]
  readonly tasks: readonly Task[]
  readonly workspace?: Workspace
}

type RecentRunRow = Record<'duration' | 'status' | 'task', string>

const statusLabel: Record<TaskStatus, string> = {
  cancelled: 'cancelada',
  failed: 'falhou',
  succeeded: 'sucesso',
}

const formatDuration = (durationMs: number): string => {
  if (durationMs < 1000) {
    return `${durationMs} ms`
  }

  return `${(durationMs / 1000).toFixed(1)} s`
}

function healthMetric(
  report: DiagnosticReport | undefined,
  separator: string,
): {
  readonly detail?: string
  readonly tone: MetricTone
  readonly value: string
} {
  if (!report) {
    return {tone: 'default', value: 'não verificado'}
  }

  const detail = `${report.summary.pass} ok ${separator} ${report.summary.warn} avisos ${separator} ${report.summary.fail} falhas`
  if (report.summary.fail > 0) {
    return {detail, tone: 'error', value: 'requer atenção'}
  }

  if (report.summary.warn > 0) {
    return {detail, tone: 'warning', value: 'com avisos'}
  }

  return {detail, tone: 'success', value: 'saudável'}
}

export function HomeScreen({
  error,
  inputEnabled,
  lastDiagnosticReport,
  layout,
  loading,
  navigate,
  recentRuns,
  tasks,
  workspace,
}: HomeScreenProps) {
  const theme = useTheme()
  const unicode = useUnicode()
  const compact = layout === 'compact'
  const wide = layout === 'wide'
  const separator = unicode ? '·' : '|'
  const firstTask = tasks[0]
  const latestRun = recentRuns[0]
  const health = healthMetric(lastDiagnosticReport, separator)
  const compactActions: MenuItem[] = [
    {
      disabled: !workspace && !loading,
      key: 'tasks',
      label: 'Explorar tarefas',
      shortcut: 'Enter',
    },
    {
      disabled: !firstTask,
      key: 'run',
      label: firstTask ? `Executar ${firstTask.name}` : 'Executar uma tarefa',
    },
    {key: 'doctor', label: 'Verificar ambiente'},
  ]
  const actions: MenuItem[] = [
    ...compactActions,
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

  const workspaceValue = loading ? 'carregando' : (workspace?.name ?? 'não detectado')
  const sessionValue = compact
    ? latestRun
      ? `${latestRun.taskName} (${statusLabel[latestRun.status]})`
      : 'nenhuma execução'
    : `${recentRuns.length} ${recentRuns.length === 1 ? 'execução' : 'execuções'}`
  const metricCards = [
    {
      detail: loading
        ? unicode
          ? 'Lendo package.json…'
          : 'Lendo package.json...'
        : (workspace?.packageJsonPath ?? error),
      label: 'Workspace',
      tone: error && !loading ? ('error' as const) : ('default' as const),
      value: workspaceValue,
    },
    {
      detail: workspace ? 'declarados no package.json' : 'aguardando workspace',
      label: 'Scripts',
      value: loading || !workspace ? (unicode ? '—' : '-') : String(tasks.length),
    },
    {
      detail: health.detail,
      label: 'Ambiente',
      tone: health.tone,
      value: health.value,
    },
    {
      detail: latestRun
        ? `última: ${latestRun.taskName} ${separator} ${statusLabel[latestRun.status]}`
        : undefined,
      label: 'Sessão',
      value: sessionValue,
    },
  ]

  const metrics = compact ? (
    <Panel title="Visão geral">
      <Box>
        {metricCards.slice(0, 2).map((metric) => (
          <MetricCard compact key={metric.label} {...metric} />
        ))}
      </Box>
      <Box>
        {metricCards.slice(2).map((metric) => (
          <MetricCard compact key={metric.label} {...metric} />
        ))}
      </Box>
    </Panel>
  ) : (
    <Box gap={1}>
      {metricCards.map((metric) => (
        <Box flexBasis={0} flexGrow={1} key={metric.label} minWidth={0}>
          <MetricCard {...metric} />
        </Box>
      ))}
    </Box>
  )

  const recentColumns: Column<RecentRunRow>[] = [
    {header: 'Tarefa', key: 'task', width: wide ? 20 : 16},
    {header: 'Status', key: 'status', width: wide ? 12 : 10},
    {align: 'right', header: 'Duração', key: 'duration', width: wide ? 10 : 8},
  ]
  const historyRows: RecentRunRow[] = recentRuns.slice(0, wide ? 5 : 3).map((run) => ({
    duration: formatDuration(run.durationMs),
    status: statusLabel[run.status],
    task: run.taskName,
  }))

  const history = (
    <Panel title="Execuções nesta sessão" width="100%">
      {historyRows.length > 0 ? (
        <Table columns={recentColumns} data={historyRows} maxRows={wide ? 5 : 3} />
      ) : (
        <Text color={theme.colors.mutedForeground}>As tarefas executadas aparecerão aqui.</Text>
      )}
    </Panel>
  )

  const visibleActions = compact
    ? workspace || loading
      ? compactActions
      : compactActions.filter((item) => item.key === 'doctor')
    : actions

  return (
    <Box flexDirection="column">
      {!compact ? (
        <ScreenTitle
          description="Ações rápidas e visão geral do projeto atual."
          title="Dashboard"
        />
      ) : null}
      {metrics}
      <Box flexDirection="row" gap={1} marginTop={compact ? 0 : 1}>
        <Box flexShrink={0} width={compact ? '100%' : wide ? 34 : 31}>
          <Menu
            aria-label="Ações rápidas"
            autoFocus
            isActive={inputEnabled}
            items={visibleActions}
            onSelect={selectAction}
            title="Ações rápidas"
          />
        </Box>
        {!compact ? <Box flexGrow={1}>{history}</Box> : null}
      </Box>
    </Box>
  )
}
