import {access, mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {setTimeout as delay} from 'node:timers/promises'

import {afterEach, describe, expect, it} from 'vitest'

import {ExecaTaskRunner} from '@/features/tasks/adapters/execa-task-runner.js'
import type {Task} from '@/features/tasks/index.js'
import type {Workspace} from '@/features/workspace/index.js'

const temporaryDirectories: string[] = []

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === 'ENOENT') return false
    throw error
  }
}

function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error: unknown) {
    return !(isNodeError(error) && error.code === 'ESRCH')
  }
}

async function waitForProcessExit(pid: number, timeoutMs = 2000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (!processExists(pid)) return true
    await delay(25)
  }

  return !processExists(pid)
}

async function createWorkspace(name: string, command: string): Promise<Workspace> {
  const directory = await mkdtemp(join(tmpdir(), 'my-cli-runner-'))
  temporaryDirectories.push(directory)
  await writeFile(
    join(directory, 'package.json'),
    JSON.stringify({name: 'runner-fixture', private: true, scripts: {[name]: command}}),
  )
  return {
    name: 'runner-fixture',
    packageJsonPath: join(directory, 'package.json'),
    path: directory,
    scripts: {[name]: command},
  }
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map(async (directory) => rm(directory, {force: true, recursive: true})),
  )
})

describe('ExecaTaskRunner', () => {
  it('streams and limits output while running npm without a shell', async () => {
    const task: Task = {
      command: 'node -e output',
      name: 'output',
    }
    const workspace = await createWorkspace(
      task.name,
      `node -e "process.stdout.write('abcdef'); process.stderr.write('oops')"`,
    )
    const chunks: string[] = []

    const result = await new ExecaTaskRunner().run(workspace, task, {
      onOutput: (_stream, chunk) => chunks.push(chunk),
      outputLimit: 4,
    })

    expect(result).toMatchObject({
      exitCode: 0,
      outputTruncated: true,
      status: 'succeeded',
      stderr: 'oops',
      stdout: 'cdef',
    })
    expect(chunks.join('')).toContain('abcdef')
    expect(chunks.join('')).toContain('oops')
  })

  it('preserves a failed task exit code', async () => {
    const task: Task = {command: 'node exits 7', name: 'fail'}
    const workspace = await createWorkspace(task.name, `node -e "process.exit(7)"`)

    const result = await new ExecaTaskRunner().run(workspace, task)

    expect(result.status).toBe('failed')
    expect(result.exitCode).toBe(7)
  })

  it('runs an exact script name that starts with a hyphen', async () => {
    const task: Task = {command: 'node prints marker', name: '--help'}
    const workspace = await createWorkspace(
      task.name,
      `node -e "process.stdout.write('hyphen-script-ran')"`,
    )

    const result = await new ExecaTaskRunner().run(workspace, task)

    expect(result.status).toBe('succeeded')
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('hyphen-script-ran')
    expect(result.stdout).not.toContain('Usage: npm')
  })

  it('preserves a UTF-8 code point split across subprocess writes', async () => {
    const task: Task = {command: 'node split-unicode.cjs', name: 'unicode'}
    const workspace = await createWorkspace(task.name, task.command)
    await writeFile(
      join(workspace.path, 'split-unicode.cjs'),
      [
        `const bytes = Buffer.from('😀')`,
        `process.stdout.write(bytes.subarray(0, 2))`,
        `setTimeout(() => process.stdout.write(bytes.subarray(2)), 20)`,
      ].join('\n'),
    )
    const chunks: string[] = []

    const result = await new ExecaTaskRunner().run(workspace, task, {
      onOutput: (stream, chunk) => {
        if (stream === 'stdout') chunks.push(chunk)
      },
      outputLimit: 1,
    })

    expect(result.status).toBe('succeeded')
    expect(result.outputTruncated).toBe(true)
    expect(result.stdout).toBe('😀')
    expect(result.stdout).not.toContain('�')
    expect(chunks.join('')).toContain('😀')
    expect(chunks.join('')).not.toContain('�')
  })

  it('cancels the npm process tree with an AbortSignal', async () => {
    const task: Task = {command: 'node waits', name: 'wait'}
    const workspace = await createWorkspace(task.name, 'node cancellation-child.cjs')
    const sentinelPath = join(workspace.path, 'late-sentinel')
    await writeFile(
      join(workspace.path, 'cancellation-child.cjs'),
      [
        `const {writeFileSync} = require('node:fs')`,
        `process.stdout.write('child-pid:' + process.pid + '\\n')`,
        `setTimeout(() => writeFileSync('late-sentinel', 'still-running'), 600)`,
        `setInterval(() => {}, 1000)`,
      ].join('\n'),
    )
    const controller = new AbortController()
    let childPid: number | undefined
    let stdout = ''
    const cleanupTimeout = setTimeout(() => controller.abort(), 3000)

    try {
      const result = await new ExecaTaskRunner().run(workspace, task, {
        onOutput: (stream, chunk) => {
          if (stream !== 'stdout' || childPid !== undefined) return
          stdout += chunk
          const match = /child-pid:(\d+)/u.exec(stdout)
          if (!match?.[1]) return

          childPid = Number.parseInt(match[1], 10)
          controller.abort()
        },
        signal: controller.signal,
      })

      expect(childPid).toEqual(expect.any(Number))
      expect(result.status).toBe('cancelled')
      expect(result.exitCode).toBe(130)

      if (process.platform === 'win32') {
        await delay(800)
        await expect(fileExists(sentinelPath)).resolves.toBe(false)
      } else {
        await expect(waitForProcessExit(childPid as number)).resolves.toBe(true)
      }
    } finally {
      controller.abort()
      clearTimeout(cleanupTimeout)
    }
  })

  it('rejects invalid output limits', () => {
    expect(() => new ExecaTaskRunner(-1)).toThrow(RangeError)
  })
})
