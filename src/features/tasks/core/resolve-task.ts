import {TaskNotFoundError, type Task} from './types.js'

export function resolveTask(tasks: readonly Task[], taskName: string): Task {
  const task = tasks.find((candidate) => candidate.name === taskName)

  if (!task) {
    throw new TaskNotFoundError(
      taskName,
      tasks.map(({name}) => name),
    )
  }

  return task
}
