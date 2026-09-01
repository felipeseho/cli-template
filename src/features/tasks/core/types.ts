export interface Task {
  readonly command: string
  readonly name: string
}

export type TaskStatus = 'cancelled' | 'failed' | 'succeeded'
export type TaskOutputStream = 'stderr' | 'stdout'

export interface TaskResult {
  readonly durationMs: number
  readonly error?: string
  readonly exitCode: number
  readonly outputTruncated: boolean
  readonly status: TaskStatus
  readonly stderr: string
  readonly stdout: string
  readonly task: Task
  readonly workspacePath: string
}

export type TaskEvent =
  | {
      readonly at: string
      readonly task: Task
      readonly type: 'started'
    }
  | {
      readonly chunk: string
      readonly stream: TaskOutputStream
      readonly task: Task
      readonly type: 'output'
    }
  | {
      readonly result: TaskResult
      readonly task: Task
      readonly type: 'completed'
    }
  | {
      readonly result: TaskResult
      readonly task: Task
      readonly type: 'failed'
    }
  | {
      readonly result: TaskResult
      readonly task: Task
      readonly type: 'cancelled'
    }

export class TaskNotFoundError extends Error {
  readonly code = 'TASK_NOT_FOUND'

  constructor(
    readonly taskName: string,
    readonly availableTasks: readonly string[],
  ) {
    super(
      availableTasks.length === 0
        ? `Task "${taskName}" was not found because this workspace has no scripts.`
        : `Task "${taskName}" was not found. Available tasks: ${availableTasks.join(', ')}.`,
    )
    this.name = 'TaskNotFoundError'
  }
}
