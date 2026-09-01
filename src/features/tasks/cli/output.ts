import type {Workspace} from '@/features/workspace/index.js'

import type {Task} from '../core/types.js'

export interface TaskListOutput {
  readonly tasks: readonly Task[]
  readonly workspace: {
    readonly name: string
    readonly packageJsonPath: string
    readonly path: string
  }
}

export function toTaskListOutput(workspace: Workspace, tasks: readonly Task[]): TaskListOutput {
  return {
    tasks,
    workspace: {
      name: workspace.name,
      packageJsonPath: workspace.packageJsonPath,
      path: workspace.path,
    },
  }
}
