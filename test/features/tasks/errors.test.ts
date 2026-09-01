import {describe, expect, it} from 'vitest'

import {mapTaskCliError} from '@/features/tasks/cli/errors.js'
import {TaskNotFoundError} from '@/features/tasks/index.js'

describe('task CLI errors', () => {
  it('maps domain failures to the existing CLI contract', () => {
    expect(mapTaskCliError(new TaskNotFoundError('missing', ['build']))).toEqual({
      code: 'TASK_NOT_FOUND',
      exitCode: 2,
      message: 'Task "missing" was not found. Available tasks: build.',
      suggestions: ['Run "mycli task list" to inspect scripts in this workspace.'],
    })
    expect(mapTaskCliError(new Error('unexpected'))).toBeUndefined()
  })
})
