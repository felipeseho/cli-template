import {useCallback} from 'react'

import type {DiagnosticContext, DiagnosticReport} from '@/features/doctor/index.js'
import {DoctorScreen} from '@/features/doctor/tui/doctor-screen.js'
import type {Task, TaskResult} from '@/features/tasks/index.js'
import {TaskListScreen} from '@/features/tasks/tui/task-list-screen.js'
import {TaskRunScreen} from '@/features/tasks/tui/task-run-screen.js'
import type {TaskActivity} from '@/features/tasks/tui/use-task-run.js'
import type {Workspace} from '@/features/workspace/index.js'
import type {ApplicationServices} from '@/runtime/services.js'
import type {DashboardLayout} from '@/tui/layout.js'

import type {ScreenRoute} from './routes.js'
import type {RecentRun} from './screens/home.js'
import {HelpScreen} from './screens/help.js'
import {HomeScreen} from './screens/home.js'

export interface RouterProps {
  readonly diagnosticContext: DiagnosticContext
  readonly inputEnabled: boolean
  readonly lastDiagnosticReport?: DiagnosticReport
  readonly layout: DashboardLayout
  readonly navigate: (route: ScreenRoute) => void
  readonly onDiagnosticsCompleted?: (report: DiagnosticReport) => void
  readonly onDiagnosticsError?: (error: unknown) => void
  readonly onDialogOpenChange: (isOpen: boolean) => void
  readonly onTaskActivityChange: (activity: TaskActivity) => void
  readonly onTaskCompleted: (result: TaskResult) => void
  readonly onTaskError?: (error: unknown) => void
  readonly recentRuns: readonly RecentRun[]
  readonly route: ScreenRoute
  readonly services: ApplicationServices
  readonly tasks: readonly Task[]
  readonly taskOutputLimit?: number
  readonly viewportRows: number
  readonly wide: boolean
  readonly workspace?: Workspace
  readonly workspaceError?: string
  readonly workspaceLoading: boolean
}

export function Router({
  diagnosticContext,
  inputEnabled,
  lastDiagnosticReport,
  layout,
  navigate,
  onDiagnosticsCompleted,
  onDiagnosticsError,
  onDialogOpenChange,
  onTaskActivityChange,
  onTaskCompleted,
  onTaskError,
  recentRuns,
  route,
  services,
  tasks,
  taskOutputLimit,
  viewportRows,
  wide,
  workspace,
  workspaceError,
  workspaceLoading,
}: RouterProps) {
  const runDiagnostics = useCallback<ApplicationServices['runDiagnostics']>(
    (context) => services.runDiagnostics(context),
    [services],
  )
  const runTask = useCallback<ApplicationServices['runTask']>(
    (input) => services.runTask(input),
    [services],
  )

  switch (route.screen) {
    case 'doctor': {
      return (
        <DoctorScreen
          context={diagnosticContext}
          inputEnabled={inputEnabled}
          onCompleted={onDiagnosticsCompleted}
          onError={onDiagnosticsError}
          runDiagnostics={runDiagnostics}
          viewportRows={viewportRows}
          wide={wide}
        />
      )
    }
    case 'help': {
      return <HelpScreen viewportRows={viewportRows} wide={wide} />
    }
    case 'home': {
      return (
        <HomeScreen
          error={workspaceError}
          inputEnabled={inputEnabled}
          lastDiagnosticReport={lastDiagnosticReport}
          layout={layout}
          loading={workspaceLoading}
          navigate={navigate}
          recentRuns={recentRuns}
          tasks={tasks}
          workspace={workspace}
        />
      )
    }
    case 'task-list': {
      return (
        <TaskListScreen
          error={workspaceError}
          inputEnabled={inputEnabled}
          loading={workspaceLoading}
          navigate={navigate}
          tasks={tasks}
          viewportRows={viewportRows}
          wide={wide}
          workspace={workspace}
        />
      )
    }
    case 'task-run': {
      return (
        <TaskRunScreen
          key={route.taskName ?? '_select'}
          error={workspaceError}
          initialTask={route.taskName}
          inputEnabled={inputEnabled}
          loading={workspaceLoading}
          navigate={navigate}
          onActivityChange={onTaskActivityChange}
          onCompleted={onTaskCompleted}
          onDialogOpenChange={onDialogOpenChange}
          onError={onTaskError}
          runTask={runTask}
          taskOutputLimit={taskOutputLimit}
          tasks={tasks}
          viewportRows={viewportRows}
          workspace={workspace}
        />
      )
    }
  }
}
