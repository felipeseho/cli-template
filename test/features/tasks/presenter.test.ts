import {describe, expect, it} from 'vitest'

import {toTaskListOutput} from '@/features/tasks/cli/output.js'
import {presentTaskListHuman, presentTaskResultHuman} from '@/features/tasks/cli/presenter.js'
import type {TaskResult} from '@/features/tasks/index.js'
import type {Workspace} from '@/features/workspace/index.js'

const workspace: Workspace = {
  name: 'fixture',
  packageJsonPath: '/workspace/package.json',
  path: '/workspace',
  scripts: {build: 'tsc'},
}

const taskResult: TaskResult = {
  durationMs: 10,
  exitCode: 0,
  outputTruncated: false,
  status: 'succeeded',
  stderr: '',
  stdout: '\u001B[31mdone\u001B[39m',
  task: {command: 'tsc', name: 'build'},
  workspacePath: '/workspace',
}

describe('task CLI presentation', () => {
  it('renders a task table and empty state', () => {
    expect(presentTaskListHuman(workspace, [{command: 'tsc', name: 'build'}])).toMatch(
      /TASK\s+COMMAND\n-+\s+-+\nbuild\s+tsc/u,
    )
    expect(presentTaskListHuman({...workspace, scripts: {}}, [])).toBe(
      'No npm scripts found in /workspace/package.json.',
    )
  })

  it('renders task summaries', () => {
    expect(presentTaskResultHuman(taskResult)).toBe('Task "build" completed in 10ms (exit 0).')
  })

  it('maps the task-list JSON contract without serializing it', () => {
    const tasks = [{command: 'tsc', name: 'build'}]

    expect(toTaskListOutput(workspace, tasks)).toEqual({
      tasks,
      workspace: {
        name: 'fixture',
        packageJsonPath: '/workspace/package.json',
        path: '/workspace',
      },
    })
  })
})
