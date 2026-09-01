import {performance} from 'node:perf_hooks'
import type {Readable} from 'node:stream'

import {execa} from 'execa'

import type {TaskRunner, TaskRunnerOptions} from '../../features/tasks/ports.js'
import type {Task, TaskOutputStream, TaskResult} from '../../features/tasks/types.js'
import type {Workspace} from '../../features/workspace/types.js'

export const DEFAULT_OUTPUT_LIMIT = 64 * 1024

class LimitedOutputBuffer {
  #truncated = false
  #value = ''

  constructor(private readonly limit: number) {}

  append(chunk: string): void {
    if (chunk.length === 0) return

    const characters = [...this.#value, ...chunk]
    if (characters.length <= this.limit) {
      this.#value = characters.join('')
      return
    }

    this.#truncated = true
    this.#value = this.limit === 0 ? '' : characters.slice(-this.limit).join('')
  }

  get truncated(): boolean {
    return this.#truncated
  }

  toString(): string {
    return this.#value
  }
}

function readErrorMessage(result: object): string | undefined {
  for (const key of ['shortMessage', 'originalMessage', 'message'] as const) {
    const value = Reflect.get(result, key) as unknown
    if (typeof value === 'string' && value.length > 0) return value
  }

  return undefined
}

function attachOutput(
  readable: Readable | null | undefined,
  stream: TaskOutputStream,
  capture: LimitedOutputBuffer,
  onOutput?: (stream: TaskOutputStream, chunk: string) => void,
): void {
  readable?.setEncoding('utf8')
  readable?.on('data', (chunk: string) => {
    capture.append(chunk)
    onOutput?.(stream, chunk)
  })
}

export class ExecaTaskRunner implements TaskRunner {
  constructor(private readonly defaultOutputLimit = DEFAULT_OUTPUT_LIMIT) {
    if (!Number.isSafeInteger(defaultOutputLimit) || defaultOutputLimit < 0) {
      throw new RangeError('defaultOutputLimit must be a non-negative safe integer.')
    }
  }

  async run(
    workspace: Workspace,
    task: Task,
    options: TaskRunnerOptions = {},
  ): Promise<TaskResult> {
    const outputLimit = options.outputLimit ?? this.defaultOutputLimit
    if (!Number.isSafeInteger(outputLimit) || outputLimit < 0) {
      throw new RangeError('outputLimit must be a non-negative safe integer.')
    }

    const stdout = new LimitedOutputBuffer(outputLimit)
    const stderr = new LimitedOutputBuffer(outputLimit)
    const startedAt = performance.now()
    const subprocess = execa('npm', ['run', '--', task.name], {
      buffer: false,
      cleanup: true,
      forceKillAfterDelay: 1000,
      killDescendants: true,
      reject: false,
      shell: false,
      stderr: 'pipe',
      stdout: 'pipe',
      ...(options.signal ? {cancelSignal: options.signal} : {}),
      cwd: workspace.path,
    })

    attachOutput(subprocess.stdout, 'stdout', stdout, options.onOutput)
    attachOutput(subprocess.stderr, 'stderr', stderr, options.onOutput)

    const outcome = await subprocess
    const cancelled = outcome.isCanceled
    const status = cancelled ? 'cancelled' : outcome.failed ? 'failed' : 'succeeded'
    const error = outcome.failed && !cancelled ? readErrorMessage(outcome) : undefined

    return {
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      ...(error === undefined ? {} : {error}),
      exitCode: cancelled ? 130 : (outcome.exitCode ?? 1),
      outputTruncated: stdout.truncated || stderr.truncated,
      status,
      stderr: stderr.toString(),
      stdout: stdout.toString(),
      task,
      workspacePath: workspace.path,
    }
  }
}
