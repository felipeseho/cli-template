import type {Task, TaskResult} from '../../features/tasks/types.js'
import type {Workspace} from '../../features/workspace/types.js'
import {presentJson} from './serialize.js'

export function presentTaskListJson(workspace: Workspace, tasks: readonly Task[]): string {
  return presentJson({
    tasks,
    workspace: {
      name: workspace.name,
      packageJsonPath: workspace.packageJsonPath,
      path: workspace.path,
    },
  })
}

export function presentTaskResultJson(result: TaskResult): string {
  return presentJson(result)
}
