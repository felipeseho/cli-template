import {PassThrough} from 'node:stream'
import {join} from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'

import type * as OclifCore from '@oclif/core'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

const core = vi.hoisted(() => ({
  execute: vi.fn(),
  flush: vi.fn(),
  handle: vi.fn(),
  loadConfig: vi.fn(),
  settings: {debug: false},
}))
const runtime = vi.hoisted(() => ({
  createApplicationServices: vi.fn(),
  renderTui: vi.fn(),
}))

vi.mock('@oclif/core', async (importOriginal) => {
  const actual = await importOriginal<typeof OclifCore>()
  return {
    ...actual,
    Config: {load: core.loadConfig},
    execute: core.execute,
    flush: core.flush,
    handle: core.handle,
    settings: core.settings,
  }
})

vi.mock('@/runtime/container.js', () => ({
  createApplicationServices: runtime.createApplicationServices,
}))
vi.mock('@/runtime/render-tui.js', () => ({renderTui: runtime.renderTui}))

import {resolveCliInvocation, runCli} from '@/runtime/run-cli.js'

const runEntryPoint = pathToFileURL(join(process.cwd(), 'bin', 'run.js')).href
const developmentEntryPoint = pathToFileURL(join(process.cwd(), 'bin', 'dev.js')).href

function terminalStreams(isTTY: boolean) {
  const stdin = new PassThrough()
  const stdout = new PassThrough()
  const stderr = new PassThrough()
  Object.defineProperty(stdin, 'isTTY', {value: isTTY})
  Object.defineProperty(stdout, 'isTTY', {value: isTTY})

  return {
    stderr: stderr as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    stdout: stdout as unknown as NodeJS.WriteStream,
  }
}

describe('CLI runtime dispatch', () => {
  let originalNodeEnvironment: string | undefined
  let runHook: ReturnType<typeof vi.fn>

  beforeEach(() => {
    originalNodeEnvironment = process.env.NODE_ENV
    process.exitCode = undefined
    core.settings.debug = false
    core.execute.mockResolvedValue(undefined)
    core.flush.mockResolvedValue(undefined)
    core.handle.mockResolvedValue(undefined)
    runtime.createApplicationServices.mockReturnValue({kind: 'services'})
    runtime.renderTui.mockResolvedValue(0)
    runHook = vi.fn().mockResolvedValue({failures: [], successes: []})
    core.loadConfig.mockResolvedValue({
      bin: 'mycli',
      runHook,
      version: '1.2.3',
    })
  })

  afterEach(() => {
    if (originalNodeEnvironment === undefined) Reflect.deleteProperty(process.env, 'NODE_ENV')
    else process.env.NODE_ENV = originalNodeEnvironment
    process.exitCode = undefined
  })

  it('resolves the adaptive root invocation without changing command arguments', () => {
    expect(resolveCliInvocation([], true)).toEqual({kind: 'dashboard'})
    expect(resolveCliInvocation([], false)).toEqual({args: ['--help'], kind: 'oclif'})
    expect(resolveCliInvocation(['--no-interactive'], true)).toEqual({
      args: ['--help'],
      kind: 'oclif',
    })
    expect(resolveCliInvocation(['task', 'list'], true)).toEqual({
      args: ['task', 'list'],
      kind: 'oclif',
    })
  })

  it('delegates root text fallback and regular commands to oclif', async () => {
    await runCli({args: [], dir: runEntryPoint, ...terminalStreams(false)})
    expect(core.execute).toHaveBeenLastCalledWith({
      args: ['--help'],
      development: false,
      dir: runEntryPoint,
    })

    await runCli({
      args: ['task', 'list'],
      dir: runEntryPoint,
      ...terminalStreams(true),
    })
    expect(core.execute).toHaveBeenLastCalledWith({
      args: ['task', 'list'],
      development: false,
      dir: runEntryPoint,
    })
    expect(core.loadConfig).not.toHaveBeenCalled()
  })

  it('loads config, runs lifecycle hooks, and opens the root dashboard in a TTY', async () => {
    await runCli({args: [], dir: runEntryPoint, ...terminalStreams(true)})

    expect(core.loadConfig).toHaveBeenCalledWith(fileURLToPath(runEntryPoint))
    expect(runHook).toHaveBeenNthCalledWith(1, 'init', {argv: [], id: undefined})
    expect(runtime.renderTui).toHaveBeenCalledWith(
      expect.objectContaining({
        initialRoute: 'home',
        name: 'mycli',
        services: {kind: 'services'},
        version: '1.2.3',
      }),
    )
    expect(runHook).toHaveBeenNthCalledWith(
      2,
      'finally',
      expect.objectContaining({Command: undefined, error: undefined, id: ''}),
    )
    expect(core.flush).toHaveBeenCalledOnce()
    expect(core.handle).not.toHaveBeenCalled()
  })

  it('runs finally and delegates a dashboard failure to the oclif handler', async () => {
    const failure = new Error('render failed')
    runtime.renderTui.mockRejectedValue(failure)

    await runCli({args: [], dir: runEntryPoint, ...terminalStreams(true)})

    expect(runHook).toHaveBeenLastCalledWith('finally', expect.objectContaining({error: failure}))
    expect(core.handle).toHaveBeenCalledWith(failure)
    expect(runHook.mock.invocationCallOrder.at(-1)).toBeLessThan(
      core.handle.mock.invocationCallOrder[0] ?? 0,
    )
    expect(core.flush).not.toHaveBeenCalled()
  })

  it('runs finally before handling an init hook failure', async () => {
    const failure = new Error('init failed')
    runHook.mockRejectedValueOnce(failure)

    await runCli({args: [], dir: runEntryPoint, ...terminalStreams(true)})

    expect(runtime.renderTui).not.toHaveBeenCalled()
    expect(runHook).toHaveBeenLastCalledWith('finally', expect.objectContaining({error: failure}))
    expect(core.handle).toHaveBeenCalledWith(failure)
    expect(runHook.mock.invocationCallOrder.at(-1)).toBeLessThan(
      core.handle.mock.invocationCallOrder[0] ?? 0,
    )
    expect(core.flush).not.toHaveBeenCalled()
  })

  it('uses the oclif handler when flushing a successful dashboard fails', async () => {
    const failure = new Error('flush failed')
    core.flush.mockRejectedValueOnce(failure)

    await runCli({args: [], dir: runEntryPoint, ...terminalStreams(true)})

    expect(runHook).toHaveBeenLastCalledWith('finally', expect.objectContaining({error: undefined}))
    expect(core.handle).toHaveBeenCalledWith(failure)
  })

  it('prepares development before loading config and propagates the Ink exit code', async () => {
    core.loadConfig.mockImplementation(() => {
      expect(process.env.NODE_ENV).toBe('development')
      expect(core.settings.debug).toBe(true)
      return Promise.resolve({bin: 'mycli', runHook, version: '1.2.3'})
    })
    runtime.renderTui.mockResolvedValue(130)

    await runCli({
      args: [],
      development: true,
      dir: developmentEntryPoint,
      ...terminalStreams(true),
    })

    expect(process.exitCode).toBe(130)
  })
})
