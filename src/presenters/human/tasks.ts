import type {Task, TaskResult} from '../../features/tasks/types.js'
import type {Workspace} from '../../features/workspace/types.js'
import {formatTable, sanitizeTerminalText} from './table.js'

export function presentTaskListHuman(workspace: Workspace, tasks: readonly Task[]): string {
  if (tasks.length === 0) {
    return `No npm scripts found in ${sanitizeTerminalText(workspace.packageJsonPath)}.`
  }

  return [
    `Tasks in ${sanitizeTerminalText(workspace.name)} (${sanitizeTerminalText(workspace.path)})`,
    '',
    formatTable(tasks, [
      {header: 'TASK', value: ({name}) => name},
      {header: 'COMMAND', value: ({command}) => command},
    ]),
  ].join('\n')
}

export function presentTaskResultHuman(result: TaskResult): string {
  const verb =
    result.status === 'succeeded'
      ? 'completed'
      : result.status === 'cancelled'
        ? 'was cancelled'
        : 'failed'
  const truncation = result.outputTruncated ? ' Captured output was truncated.' : ''

  return `Task "${sanitizeTerminalText(result.task.name)}" ${verb} in ${result.durationMs}ms (exit ${result.exitCode}).${truncation}`
}
