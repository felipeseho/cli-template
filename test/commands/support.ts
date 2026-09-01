import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

import type {Interfaces} from '@oclif/core'
import {runCommand} from '@oclif/test'
import {register} from 'tsx/esm/api'
import {afterAll, afterEach, beforeAll, beforeEach, expect} from 'vitest'

export type JsonRecord = Record<string, unknown>

interface WorkspacePackage {
  readonly name: string
  readonly private: true
  readonly scripts: Readonly<Record<string, string>>
}

interface ExpectedJsonError {
  readonly code?: string
  readonly suggestions?: readonly string[]
}

const projectRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))))

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

export function parseJson(stdout: string): JsonRecord {
  expect(stdout).not.toContain(`${String.fromCodePoint(27)}[`)
  return JSON.parse(stdout) as JsonRecord
}

export function expectJsonError(
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

export function expectThrownError(
  error: Awaited<ReturnType<typeof runCommand>>['error'],
  exitCode: number,
  message: string,
): void {
  expect(error).toBeDefined()
  expect(error?.oclif?.exit).toBe(exitCode)
  expect(error?.message).toContain(message)
  expect(process.exitCode).toBe(exitCode)
}

export function setupCliTestEnvironment() {
  let loadOptions: Interfaces.LoadOptions
  let originalCwd: string
  let originalExitCode: NodeJS.Process['exitCode']
  let restoreTty: (() => void) | undefined
  let unregisterTsx: (() => Promise<void>) | undefined
  const temporaryDirectories: string[] = []

  beforeAll(async () => {
    // oclif discovers the TypeScript command tree from fixture cwd values, so
    // each Vitest worker needs an explicit project-scoped loader.
    unregisterTsx = register({tsconfig: join(projectRoot, 'tsconfig.json')})
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

  afterAll(async () => unregisterTsx?.())

  beforeEach(() => {
    originalCwd = process.cwd()
    originalExitCode = process.exitCode
    process.exitCode = undefined
    restoreTty = forceTtyState(false)
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    restoreTty?.()
    restoreTty = undefined
    process.exitCode = originalExitCode
    await Promise.all(
      temporaryDirectories
        .splice(0)
        .map(async (directory) => rm(directory, {force: true, recursive: true})),
    )
  })

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

  async function runCli<T = unknown>(args: string[]) {
    return runCommand<T>(args, loadOptions)
  }

  function setTtyState(isTTY: boolean): void {
    restoreTty?.()
    restoreTty = forceTtyState(isTTY)
  }

  return {
    createEmptyDirectory,
    createWorkspace,
    projectRoot,
    runCli,
    setTtyState,
  }
}
