import {describe, expect, it, vi} from 'vitest'

import {listTasks} from '@/features/tasks/list-tasks.js'
import type {TaskCatalog, TaskRunner} from '@/features/tasks/ports.js'
import {resolveTask} from '@/features/tasks/resolve-task.js'
import {runTask} from '@/features/tasks/run-task.js'
import {TaskNotFoundError, type TaskEvent, type TaskResult} from '@/features/tasks/types.js'
import type {Workspace} from '@/features/workspace/types.js'

const workspace: Workspace = {
  name: 'fixture',
  packageJsonPath: '/workspace/package.json',
  path: '/workspace',
  scripts: {build: 'tsc'},
}

const catalog: TaskCatalog = {
  list() {
    return Promise.resolve([{command: 'tsc', name: 'build'}])
  },
}

function result(status: TaskResult['status'] = 'succeeded'): TaskResult {
  return {
    durationMs: 12,
    exitCode: status === 'succeeded' ? 0 : status === 'cancelled' ? 130 : 1,
    outputTruncated: false,
    status,
    stderr: '',
    stdout: 'done',
    task: {command: 'tsc', name: 'build'},
    workspacePath: workspace.path,
  }
}

describe('listTasks', () => {
  it('delegates to the catalog', async () => {
    const list = vi.spyOn(catalog, 'list')

    await expect(listTasks({catalog}, workspace)).resolves.toEqual([
      {command: 'tsc', name: 'build'},
    ])
    expect(list).toHaveBeenCalledWith(workspace)
  })
})

describe('resolveTask', () => {
  it('returns an exact task and rejects an unknown name', () => {
    const tasks = [{command: 'tsc', name: 'build'}]

    expect(resolveTask(tasks, 'build')).toEqual(tasks[0])
    expect(() => resolveTask(tasks, 'missing')).toThrow(TaskNotFoundError)
  })
})

describe('runTask', () => {
  it('publishes started, output, and completed events in order', async () => {
    const events: TaskEvent[] = []
    const runner: TaskRunner = {
      run(_workspace, _task, options) {
        options?.onOutput?.('stdout', 'done')
        return Promise.resolve(result())
      },
    }

    await expect(
      runTask(
        {catalog, now: () => new Date('2026-09-01T12:00:00.000Z'), runner},
        {onEvent: (event) => events.push(event), taskName: 'build', workspace},
      ),
    ).resolves.toEqual(result())

    expect(events.map(({type}) => type)).toEqual(['started', 'output', 'completed'])
    expect(events[0]).toMatchObject({at: '2026-09-01T12:00:00.000Z', type: 'started'})
    expect(events[1]).toMatchObject({chunk: 'done', stream: 'stdout', type: 'output'})
  })

  it.each([
    ['failed', 'failed'],
    ['cancelled', 'cancelled'],
  ] as const)('publishes a %s terminal event', async (status, expectedEvent) => {
    const events: TaskEvent[] = []
    const runner: TaskRunner = {
      run() {
        return Promise.resolve(result(status))
      },
    }

    await runTask(
      {catalog, runner},
      {onEvent: (event) => events.push(event), taskName: 'build', workspace},
    )

    expect(events.at(-1)?.type).toBe(expectedEvent)
  })

  it('rejects unknown task names before starting a process', async () => {
    const run = vi.fn<TaskRunner['run']>()
    const runner: TaskRunner = {run}

    await expect(
      runTask({catalog, runner}, {taskName: 'unknown', workspace}),
    ).rejects.toBeInstanceOf(TaskNotFoundError)
    expect(run).not.toHaveBeenCalled()
  })
})
