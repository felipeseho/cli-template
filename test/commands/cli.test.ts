import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

import type {Interfaces} from '@oclif/core'
import {runCommand} from '@oclif/test'
import {afterEach, beforeAll, beforeEach, describe, expect, it} from 'vitest'

const projectRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))))

type JsonRecord = Record<string, unknown>

interface WorkspacePackage {
  readonly name: string
  readonly private: true
  readonly scripts: Readonly<Record<string, string>>
}

interface ExpectedJsonError {
  readonly code?: string
  readonly suggestions?: readonly string[]
}

let loadOptions: Interfaces.LoadOptions
let originalCwd: string
let originalExitCode: NodeJS.Process['exitCode']
let temporaryDirectories: string[]
let restoreTty: (() => void) | undefined

function forceTtyState(isTTY: boolean): () => void {
  const stdinDescriptor = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY')
  const stdoutDescriptor = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY')

  Object.defineProperty(process.stdin, 'isTTY', {configurable: true, value: isTTY})
  Object.defineProperty(process.stdout, 'isTTY', {configurable: true, value: isTTY})

  return () => {
    if (stdinDescriptor) Object.defineProperty(process.stdin, 'isTTY', stdinDescriptor)
    else Reflect.deleteProperty(process.stdin, 'isTTY')

    if (stdoutDescriptor) Object.defineProperty(process.stdout, 'isTTY', stdoutDescriptor)
    else Reflect.deleteProperty(process.stdout, 'isTTY')
  }
}

async function createWorkspace(scripts: Readonly<Record<string, string>> = {}): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'mycli-command-test-'))
  temporaryDirectories.push(directory)
  const packageJson: WorkspacePackage = {
    name: 'fixture-workspace',
    private: true,
    scripts,
  }

  await writeFile(join(directory, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`)
  return directory
}

async function createEmptyDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'mycli-command-test-empty-'))
  temporaryDirectories.push(directory)
  return directory
}

function parseJson(stdout: string): JsonRecord {
  expect(stdout).not.toContain(`${String.fromCodePoint(27)}[`)
  return JSON.parse(stdout) as JsonRecord
}

function expectJsonError(
  payload: JsonRecord,
  exitCode: number,
  message: string,
  expected: ExpectedJsonError = {},
): JsonRecord {
  const error = payload.error as JsonRecord

  expect(error.message).toEqual(expect.any(String))
  expect(String(error.message)).toContain(message)
  expect(error.exitCode).toBe(exitCode)
  expect(
    Object.keys(error).every((key) => ['code', 'exitCode', 'message', 'suggestions'].includes(key)),
  ).toBe(true)
  expect(error).not.toHaveProperty('oclif')
  expect(error).not.toHaveProperty('context')
  expect(error).not.toHaveProperty('config')
  expect(error).not.toHaveProperty('path')
  expect(error).not.toHaveProperty('root')
  if (expected.code !== undefined) expect(error.code).toBe(expected.code)
  if (expected.suggestions !== undefined) expect(error.suggestions).toEqual(expected.suggestions)
  expect(process.exitCode).toBe(exitCode)
  return error
}

function expectThrownError(
  error: Awaited<ReturnType<typeof runCommand>>['error'],
  exitCode: number,
  message: string,
): void {
  expect(error).toBeDefined()
  expect(error?.oclif?.exit).toBe(exitCode)
  expect(error?.message).toContain(message)
  expect(process.exitCode).toBe(exitCode)
}

async function runCli<T = unknown>(args: string[]) {
  return runCommand<T>(args, loadOptions)
}

beforeAll(async () => {
  const packageJson = JSON.parse(
    await readFile(join(projectRoot, 'package.json'), 'utf8'),
  ) as JsonRecord
  const oclif = packageJson.oclif as JsonRecord

  loadOptions = {
    devPlugins: false,
    ignoreManifest: true,
    pjson: {
      ...packageJson,
      oclif: {
        ...oclif,
        commands: {
          strategy: 'pattern',
          target: './src/commands',
        },
      },
    } as Interfaces.PJSON,
    root: projectRoot,
    userPlugins: false,
  }
})

beforeEach(() => {
  originalCwd = process.cwd()
  originalExitCode = process.exitCode
  process.exitCode = undefined
  temporaryDirectories = []
  restoreTty = forceTtyState(false)
})

afterEach(async () => {
  process.chdir(originalCwd)
  restoreTty?.()
  restoreTty = undefined
  process.exitCode = originalExitCode
  await Promise.all(
    temporaryDirectories.map(async (directory) => rm(directory, {force: true, recursive: true})),
  )
})

describe.sequential('CLI commands', () => {
  it('shows help for the default command when no TTY is available', async () => {
    const {error, stdout} = await runCli([])

    expect(error).toBeUndefined()
    expect(stdout).toContain('USAGE')
    expect(stdout).toContain('mycli')
    expect(stdout).toContain('COMMANDS')
  })

  it('provides global help and version output', async () => {
    const help = await runCli(['--help'])
    const version = await runCli(['--version'])

    expect(help.error).toBeUndefined()
    expect(help.stdout).toContain('USAGE')
    expect(help.stdout).toContain('TOPICS')
    expect(help.stdout).toContain('task')
    expect(help.stdout).not.toMatch(/^\s+base\s*$/mu)
    expect(version.error).toBeUndefined()
    expect(version.stdout).toMatch(/my-cli\/0\.1\.0/u)
  })

  it('lists package scripts as a human-readable table', async () => {
    const workspace = await createWorkspace({
      build: 'tsc -p tsconfig.build.json',
      test: 'vitest run',
    })
    process.chdir(workspace)

    const {error, stdout} = await runCli(['task', 'list'])

    expect(error).toBeUndefined()
    expect(stdout).toContain('Tasks in fixture-workspace')
    expect(stdout).toContain('TASK')
    expect(stdout).toContain('COMMAND')
    expect(stdout).toContain('build')
    expect(stdout).toContain('tsc -p tsconfig.build.json')
    expect(stdout).toContain('test')
    expect(stdout).toContain('vitest run')
  })

  it('lists package scripts as one ANSI-free JSON document', async () => {
    const workspace = await createWorkspace({
      lint: 'eslint .',
      test: 'vitest run',
    })
    process.chdir(workspace)
    const canonicalWorkspace = process.cwd()

    const {error, stderr, stdout} = await runCli(['task', 'list', '--json'])
    const payload = parseJson(stdout)

    expect(error).toBeUndefined()
    expect(stderr).toBe('')
    expect(payload).toMatchObject({
      tasks: [
        {command: 'eslint .', name: 'lint'},
        {command: 'vitest run', name: 'test'},
      ],
      workspace: {
        name: 'fixture-workspace',
        packageJsonPath: join(canonicalWorkspace, 'package.json'),
        path: canonicalWorkspace,
      },
    })
  })

  it('rejects an unknown task name without executing arbitrary input', async () => {
    const workspace = await createWorkspace({safe: 'node --version'})
    process.chdir(workspace)
    const escape = String.fromCodePoint(27)
    const unsafeTaskName = `safe;${escape}[31mecho-injected${escape}[0m`

    const {error, stdout} = await runCli(['task', 'run', unsafeTaskName, '--json'])
    const payload = parseJson(stdout)

    expect(error).toBeUndefined()
    expectJsonError(payload, 2, 'Task "safe;echo-injected" was not found', {
      code: 'TASK_NOT_FOUND',
      suggestions: ['Run "mycli task list" to inspect scripts in this workspace.'],
    })
  })

  it('returns a small JSON error when the required task name is missing', async () => {
    const workspace = await createWorkspace({safe: 'node --version'})
    process.chdir(workspace)

    const {error, stderr, stdout} = await runCli(['task', 'run', '--json'])
    const payload = parseJson(stdout)

    expect(error).toBeUndefined()
    expect(stderr).toBe('')
    expectJsonError(payload, 2, 'Missing 1 required arg')
    expect(stdout).not.toContain(projectRoot)
    expect(stdout).not.toContain(process.cwd())
  })

  it('returns a small JSON error for an unknown flag', async () => {
    const workspace = await createWorkspace({safe: 'node --version'})
    process.chdir(workspace)

    const {error, stderr, stdout} = await runCli(['task', 'list', '--json', '--definitely-unknown'])
    const payload = parseJson(stdout)

    expect(error).toBeUndefined()
    expect(stderr).toBe('')
    expectJsonError(payload, 2, 'Nonexistent flag: --definitely-unknown')
    expect(stdout).not.toContain(projectRoot)
    expect(stdout).not.toContain(process.cwd())
  })

  it('rejects positional arguments after the exact task name', async () => {
    const workspace = await createWorkspace({safe: 'node --version'})
    process.chdir(workspace)

    const {error} = await runCli(['task', 'run', 'safe', '--', 'unexpected'])

    expectThrownError(error, 2, 'Unexpected argument: unexpected')
  })

  it('reports an actionable error outside a package workspace', async () => {
    const directory = await createEmptyDirectory()
    process.chdir(directory)

    const {error} = await runCli(['task', 'list'])

    expectThrownError(error, 1, 'No package.json was found')
    expect(error?.suggestions).toContain(
      'Run the command from a directory that contains package.json.',
    )
  })

  it('runs a known task and returns captured output as JSON', async () => {
    const workspace = await createWorkspace({
      ok: 'node -e "process.stdout.write(\'task-output\')"',
    })
    process.chdir(workspace)
    const canonicalWorkspace = process.cwd()

    const {error, stderr, stdout} = await runCli(['task', 'run', 'ok', '--json'])
    const payload = parseJson(stdout)

    expect(error).toBeUndefined()
    expect(stderr).toBe('')
    expect(payload).toMatchObject({
      exitCode: 0,
      outputTruncated: false,
      status: 'succeeded',
      task: {
        command: 'node -e "process.stdout.write(\'task-output\')"',
        name: 'ok',
      },
      workspacePath: canonicalWorkspace,
    })
    expect(payload.stdout).toContain('task-output')
    expect(payload.stderr).toBe('')
    expect(payload.durationMs).toEqual(expect.any(Number))
  })

  it('preserves a failing task exit code in JSON and process state', async () => {
    const workspace = await createWorkspace({
      fail: 'node -e "process.stderr.write(\'task-error\'); process.exit(7)"',
    })
    process.chdir(workspace)

    const {error, stdout} = await runCli(['task', 'run', 'fail', '--json'])
    const payload = parseJson(stdout)

    expect(error).toBeUndefined()
    expect(payload).toMatchObject({exitCode: 7, status: 'failed'})
    expect(payload.stderr).toContain('task-error')
    expect(process.exitCode).toBe(7)
  })

  it('returns a JSON doctor report with deterministic structure', async () => {
    const workspace = await createWorkspace({test: 'vitest run'})
    process.chdir(workspace)

    const {error, stdout} = await runCli(['doctor', '--json'])
    const payload = parseJson(stdout)
    const checks = payload.checks as JsonRecord[]

    expect(error).toBeUndefined()
    expect(payload.ok).toBe(true)
    expect(payload.summary).toEqual({fail: 0, pass: 5, warn: 1})
    expect(checks.map(({id}) => id)).toEqual([
      'node',
      'npm',
      'git',
      'tty',
      'workspace',
      'package-json',
    ])
    expect(checks.find(({id}) => id === 'tty')).toMatchObject({status: 'warn'})
  })

  it('rejects --interactive together with --json', async () => {
    const workspace = await createWorkspace({test: 'vitest run'})
    process.chdir(workspace)

    const {error, stdout} = await runCli(['task', 'list', '--interactive', '--json'])
    const payload = parseJson(stdout)

    expect(error).toBeUndefined()
    expectJsonError(payload, 2, '--interactive and --json cannot be used together')
  })

  it('rejects --interactive when stdin and stdout are not TTYs', async () => {
    const workspace = await createWorkspace({test: 'vitest run'})
    process.chdir(workspace)

    const {error} = await runCli(['doctor', '--interactive'])

    expectThrownError(error, 2, '--interactive requires stdin and stdout')
  })

  it('rejects an unknown interactive task before opening the TUI', async () => {
    const workspace = await createWorkspace({safe: 'node --version'})
    process.chdir(workspace)
    restoreTty?.()
    restoreTty = forceTtyState(true)

    const {error} = await runCli(['task', 'run', 'missing', '--interactive'])

    expectThrownError(error, 2, 'Task "missing" was not found')
  })
})
