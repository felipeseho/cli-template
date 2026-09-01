import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import type {DiagnosticReport} from '@/features/doctor/index.js'
import type {TaskResult} from '@/features/tasks/index.js'
import type {Workspace} from '@/features/workspace/index.js'
import type {ApplicationServices} from '@/runtime/services.js'

const runtime = vi.hoisted(() => ({
  createApplicationServices: vi.fn(),
  renderTui: vi.fn(),
}))

vi.mock('@/runtime/container.js', () => ({
  createApplicationServices: runtime.createApplicationServices,
}))
vi.mock('@/runtime/render-tui.js', () => ({renderTui: runtime.renderTui}))

import Doctor from '@/commands/doctor.js'
import TaskList from '@/commands/task/list.js'
import TaskRun from '@/commands/task/run.js'

const workspace: Workspace = {
  name: 'fixture-workspace',
  packageJsonPath: '/workspace/package.json',
  path: '/workspace',
  scripts: {safe: 'node --version'},
}
const task = {command: 'node --version', name: 'safe'} as const
const successfulReport: DiagnosticReport = {
  checks: [],
  ok: true,
  summary: {fail: 0, pass: 0, warn: 0},
}
const successfulResult: TaskResult = {
  durationMs: 1,
  exitCode: 0,
  outputTruncated: false,
  status: 'succeeded',
  stderr: '',
  stdout: '',
  task,
  workspacePath: workspace.path,
}

function createServices(): ApplicationServices {
  return {
    listTasks: vi.fn(() => [task]),
    readWorkspace: vi.fn(() => Promise.resolve(workspace)),
    runDiagnostics: vi.fn(() => Promise.resolve(successfulReport)),
    runTask: vi.fn(() => Promise.resolve(successfulResult)),
  }
}

function commandContext<T>(parsed: unknown): T {
  return {
    config: {bin: 'mycli', version: '1.2.3'},
    outputMode: vi.fn(() => 'tui'),
    parse: vi.fn(() => Promise.resolve(parsed)),
  } as unknown as T
}

describe('dashboard command routing', () => {
  let originalExitCode: NodeJS.Process['exitCode']

  beforeEach(() => {
    originalExitCode = process.exitCode
    process.exitCode = undefined
    runtime.createApplicationServices.mockReset()
    runtime.createApplicationServices.mockReturnValue(createServices())
    runtime.renderTui.mockReset()
    runtime.renderTui.mockResolvedValue(0)
  })

  afterEach(() => {
    process.exitCode = originalExitCode
  })

  it('opens each command at its corresponding dashboard route', async () => {
    await Doctor.prototype.run.call(
      commandContext<Doctor>({args: {}, flags: {'no-interactive': false}}),
    )
    await TaskList.prototype.run.call(
      commandContext<TaskList>({args: {}, flags: {'no-interactive': false}}),
    )
    await TaskRun.prototype.run.call(
      commandContext<TaskRun>({
        args: {script: 'safe'},
        flags: {'no-interactive': false, 'output-limit': 123},
      }),
    )

    expect(runtime.renderTui).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({initialRoute: 'doctor'}),
    )
    expect(runtime.renderTui).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({initialRoute: 'task-list'}),
    )
    expect(runtime.renderTui).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        initialRoute: 'task-run',
        initialTask: 'safe',
        taskOutputLimit: 123,
      }),
    )
  })

  it('turns asynchronous doctor and workspace failures into exit code 1', async () => {
    runtime.renderTui.mockImplementationOnce((rawOptions: unknown) => {
      const options = rawOptions as {onDiagnosticsError?: (error: unknown) => void}
      options.onDiagnosticsError?.(new Error('diagnostics failed'))
      return Promise.resolve(0)
    })
    await Doctor.prototype.run.call(
      commandContext<Doctor>({args: {}, flags: {'no-interactive': false}}),
    )
    expect(process.exitCode).toBe(1)

    process.exitCode = undefined
    runtime.renderTui.mockImplementationOnce((rawOptions: unknown) => {
      const options = rawOptions as {onWorkspaceError?: (error: unknown) => void}
      options.onWorkspaceError?.(new Error('workspace failed'))
      return Promise.resolve(0)
    })
    await TaskList.prototype.run.call(
      commandContext<TaskList>({args: {}, flags: {'no-interactive': false}}),
    )
    expect(process.exitCode).toBe(1)
  })

  it('uses the Ink runtime exit code before the completed task exit code', async () => {
    runtime.renderTui.mockImplementationOnce((rawOptions: unknown) => {
      const options = rawOptions as {onTaskCompleted?: (result: TaskResult) => void}
      options.onTaskCompleted?.({...successfulResult, exitCode: 7, status: 'failed'})
      return Promise.resolve(130)
    })

    await TaskRun.prototype.run.call(
      commandContext<TaskRun>({
        args: {script: 'safe'},
        flags: {'no-interactive': false, 'output-limit': 65_536},
      }),
    )

    expect(process.exitCode).toBe(130)
  })

  it('uses the task exit code, and maps a rejected runner to exit code 1', async () => {
    runtime.renderTui.mockImplementationOnce((rawOptions: unknown) => {
      const options = rawOptions as {onTaskCompleted?: (result: TaskResult) => void}
      options.onTaskCompleted?.({...successfulResult, exitCode: 7, status: 'failed'})
      return Promise.resolve(0)
    })
    await TaskRun.prototype.run.call(
      commandContext<TaskRun>({
        args: {script: 'safe'},
        flags: {'no-interactive': false, 'output-limit': 65_536},
      }),
    )
    expect(process.exitCode).toBe(7)

    process.exitCode = undefined
    runtime.renderTui.mockImplementationOnce((rawOptions: unknown) => {
      const options = rawOptions as {onTaskError?: (error: unknown) => void}
      options.onTaskError?.(new Error('runner failed'))
      return Promise.resolve(0)
    })
    await TaskRun.prototype.run.call(
      commandContext<TaskRun>({
        args: {script: 'safe'},
        flags: {'no-interactive': false, 'output-limit': 65_536},
      }),
    )
    expect(process.exitCode).toBe(1)
  })
})
