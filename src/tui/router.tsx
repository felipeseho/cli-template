import type {DiagnosticContext, DiagnosticReport} from '@/features/doctor/types.js'
import type {Task, TaskResult} from '@/features/tasks/types.js'
import type {Workspace} from '@/features/workspace/types.js'

import type {TuiServices} from './app.js'
import type {RecentRun} from './screens/home.js'
import {DoctorScreen} from './screens/doctor.js'
import {HelpScreen} from './screens/help.js'
import {HomeScreen} from './screens/home.js'
import {TaskListScreen} from './screens/task-list.js'
import {TaskRunScreen, type TaskActivity} from './screens/task-run.js'

export type ScreenName = 'doctor' | 'help' | 'home' | 'task-list' | 'task-run'

export type ScreenRoute =
  | {readonly screen: 'doctor'}
  | {readonly screen: 'help'}
  | {readonly screen: 'home'}
  | {readonly screen: 'task-list'}
  | {readonly screen: 'task-run'; readonly taskName?: string}

export type InitialRoute = ScreenName | ScreenRoute

export function normalizeRoute(route: InitialRoute = 'home', initialTask?: string): ScreenRoute {
  if (typeof route !== 'string') {
    if (route.screen === 'task-run' && initialTask && !route.taskName) {
      return {screen: 'task-run', taskName: initialTask}
    }

    return route
  }

  return route === 'task-run'
    ? {screen: route, ...(initialTask ? {taskName: initialTask} : {})}
    : {screen: route}
}

export const screenLabel = (route: ScreenRoute): string => {
  switch (route.screen) {
    case 'doctor': {
      return 'Doctor'
    }
    case 'help': {
      return 'Ajuda'
    }
    case 'home': {
      return 'Início'
    }
    case 'task-list': {
      return 'Tarefas'
    }
    case 'task-run': {
      return route.taskName ? `Executar ${route.taskName}` : 'Executar tarefa'
    }
  }
}

export interface RouterProps {
  readonly diagnosticContext: DiagnosticContext
  readonly inputEnabled: boolean
  readonly navigate: (route: ScreenRoute) => void
  readonly onDiagnosticsCompleted?: (report: DiagnosticReport) => void
  readonly onTaskActivityChange: (activity: TaskActivity) => void
  readonly onTaskCompleted: (result: TaskResult) => void
  readonly recentRuns: readonly RecentRun[]
  readonly route: ScreenRoute
  readonly services: TuiServices
  readonly tasks: readonly Task[]
  readonly viewportRows: number
  readonly wide: boolean
  readonly workspace?: Workspace
  readonly workspaceError?: string
  readonly workspaceLoading: boolean
}

export function Router({
  diagnosticContext,
  inputEnabled,
  navigate,
  onDiagnosticsCompleted,
  onTaskActivityChange,
  onTaskCompleted,
  recentRuns,
  route,
  services,
  tasks,
  viewportRows,
  wide,
  workspace,
  workspaceError,
  workspaceLoading,
}: RouterProps) {
  switch (route.screen) {
    case 'doctor': {
      return (
        <DoctorScreen
          context={diagnosticContext}
          inputEnabled={inputEnabled}
          onCompleted={onDiagnosticsCompleted}
          runDiagnostics={services.runDiagnostics}
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
          loading={workspaceLoading}
          navigate={navigate}
          recentRuns={recentRuns}
          tasks={tasks}
          viewportRows={viewportRows}
          wide={wide}
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
          services={services}
          tasks={tasks}
          viewportRows={viewportRows}
          workspace={workspace}
        />
      )
    }
  }
}
