import {writeFile} from 'node:fs/promises'
import {join} from 'node:path'

import {describe, expect, it} from 'vitest'

import {expectJsonError, expectThrownError, parseJson, setupCliTestEnvironment} from './support.js'

const {createEmptyDirectory, createWorkspace, projectRoot, runCli, setTtyState} =
  setupCliTestEnvironment()

describe.sequential('task commands', () => {
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

  it('returns the stable JSON contract for an invalid package.json', async () => {
    const workspace = await createWorkspace()
    await writeFile(join(workspace, 'package.json'), '{')
    process.chdir(workspace)

    const {error, stderr, stdout} = await runCli(['task', 'list', '--json'])
    const payload = parseJson(stdout)

    expect(error).toBeUndefined()
    expect(stderr).toBe('')
    expectJsonError(payload, 1, 'contains invalid JSON', {
      code: 'INVALID_PACKAGE_JSON',
      suggestions: ['Repair package.json and run the command again.'],
    })
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

  it('rejects --interactive together with --json', async () => {
    const workspace = await createWorkspace({test: 'vitest run'})
    process.chdir(workspace)

    const {error, stdout} = await runCli(['task', 'list', '--interactive', '--json'])
    const payload = parseJson(stdout)

    expect(error).toBeUndefined()
    expectJsonError(payload, 2, '--interactive and --json cannot be used together')
  })

  it('rejects an unknown interactive task before opening the TUI', async () => {
    const workspace = await createWorkspace({safe: 'node --version'})
    process.chdir(workspace)
    setTtyState(true)

    const {error} = await runCli(['task', 'run', 'missing', '--interactive'])

    expectThrownError(error, 2, 'Task "missing" was not found')
  })
})
