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
  cancelled: 'cancelled',
  failed: 'failed',
  succeeded: 'success',
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
    return {tone: 'default', value: 'not checked'}
  }

  const detail = `${report.summary.pass} ok ${separator} ${report.summary.warn} warnings ${separator} ${report.summary.fail} failures`
  if (report.summary.fail > 0) {
    return {detail, tone: 'error', value: 'attention required'}
  }

  if (report.summary.warn > 0) {
    return {detail, tone: 'warning', value: 'with warnings'}
  }

  return {detail, tone: 'success', value: 'healthy'}
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
      label: 'Explore tasks',
      shortcut: 'Enter',
    },
    {
      disabled: !firstTask,
      key: 'run',
      label: firstTask ? `Run ${firstTask.name}` : 'Run a task',
    },
    {key: 'doctor', label: 'Check environment'},
  ]
  const actions: MenuItem[] = [
    ...compactActions,
    {key: 'help', label: 'View shortcuts', shortcut: '?'},
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

  const workspaceValue = loading ? 'loading' : (workspace?.name ?? 'not detected')
  const sessionValue = compact
    ? latestRun
      ? `${latestRun.taskName} (${statusLabel[latestRun.status]})`
      : 'no runs'
    : `${recentRuns.length} ${recentRuns.length === 1 ? 'run' : 'runs'}`
  const metricCards = [
    {
      detail: loading
        ? unicode
          ? 'Reading package.json…'
          : 'Reading package.json...'
        : (workspace?.packageJsonPath ?? error),
      label: 'Workspace',
      tone: error && !loading ? ('error' as const) : ('default' as const),
      value: workspaceValue,
    },
    {
      detail: workspace ? 'declared in package.json' : 'waiting for workspace',
      label: 'Scripts',
      value: loading || !workspace ? (unicode ? '—' : '-') : String(tasks.length),
    },
    {
      detail: health.detail,
      label: 'Environment',
      tone: health.tone,
      value: health.value,
    },
    {
      detail: latestRun
        ? `latest: ${latestRun.taskName} ${separator} ${statusLabel[latestRun.status]}`
        : undefined,
      label: 'Session',
      value: sessionValue,
    },
  ]

  const metrics = compact ? (
    <Panel title="Overview">
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
    {header: 'Task', key: 'task', width: wide ? 20 : 16},
    {header: 'Status', key: 'status', width: wide ? 12 : 10},
    {align: 'right', header: 'Duration', key: 'duration', width: wide ? 10 : 8},
  ]
  const historyRows: RecentRunRow[] = recentRuns.slice(0, wide ? 5 : 3).map((run) => ({
    duration: formatDuration(run.durationMs),
    status: statusLabel[run.status],
    task: run.taskName,
  }))

  const history = (
    <Panel title="Runs this session" width="100%">
      {historyRows.length > 0 ? (
        <Table columns={recentColumns} data={historyRows} maxRows={wide ? 5 : 3} />
      ) : (
        <Text color={theme.colors.mutedForeground}>Completed tasks will appear here.</Text>
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
          description="Quick actions and an overview of the current project."
          title="Dashboard"
        />
      ) : null}
      {metrics}
      <Box flexDirection="row" gap={1} marginTop={compact ? 0 : 1}>
        <Box flexShrink={0} width={compact ? '100%' : wide ? 34 : 31}>
          <Menu
            aria-label="Quick actions"
            autoFocus
            isActive={inputEnabled}
            items={visibleActions}
            onSelect={selectAction}
            title="Quick actions"
          />
        </Box>
        {!compact ? <Box flexGrow={1}>{history}</Box> : null}
      </Box>
    </Box>
  )
}
