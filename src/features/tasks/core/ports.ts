import type {Workspace} from '@/features/workspace/index.js'

import type {Task, TaskOutputStream, TaskResult} from './types.js'

export interface TaskRunnerOptions {
  readonly onOutput?: (stream: TaskOutputStream, chunk: string) => void
  readonly outputLimit?: number
  readonly signal?: AbortSignal
}

export interface TaskRunner {
  run(workspace: Workspace, task: Task, options?: TaskRunnerOptions): Promise<TaskResult>
}
