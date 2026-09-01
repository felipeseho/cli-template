import type {Workspace} from '@/features/workspace/index.js'

import {listTasks} from './list-tasks.js'
import type {TaskRunner} from './ports.js'
import {resolveTask} from './resolve-task.js'
import type {TaskEvent, TaskResult} from './types.js'

export interface RunTaskDependencies {
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
  {now = () => new Date(), runner}: RunTaskDependencies,
  {onEvent, outputLimit, signal, taskName, workspace}: RunTaskInput,
): Promise<TaskResult> {
  const task = resolveTask(listTasks(workspace), taskName)

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
