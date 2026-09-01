import type {Workspace} from '../workspace/types.js'
import type {TaskCatalog, TaskRunner} from './ports.js'
import {resolveTask} from './resolve-task.js'
import type {TaskEvent, TaskResult} from './types.js'

export interface RunTaskDependencies {
  readonly catalog: TaskCatalog
  readonly now?: () => Date
  readonly runner: TaskRunner
}

export interface RunTaskInput {
  readonly onEvent?: (event: TaskEvent) => void
  readonly outputLimit?: number
  readonly signal?: AbortSignal
  readonly taskName: string
  readonly workspace: Workspace
}

export async function runTask(
  {catalog, now = () => new Date(), runner}: RunTaskDependencies,
  {onEvent, outputLimit, signal, taskName, workspace}: RunTaskInput,
): Promise<TaskResult> {
  const tasks = await catalog.list(workspace)
  const task = resolveTask(tasks, taskName)

  onEvent?.({at: now().toISOString(), task, type: 'started'})

  const result = await runner.run(workspace, task, {
    onOutput(stream, chunk) {
      onEvent?.({chunk, stream, task, type: 'output'})
    },
    ...(outputLimit === undefined ? {} : {outputLimit}),
    ...(signal === undefined ? {} : {signal}),
  })

  const terminalEvent =
    result.status === 'succeeded'
      ? 'completed'
      : result.status === 'cancelled'
        ? 'cancelled'
        : 'failed'

  onEvent?.({result, task, type: terminalEvent})
  return result
}
