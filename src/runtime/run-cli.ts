import {Config, execute, flush, handle, settings} from '@oclif/core'
import {fileURLToPath} from 'node:url'

import {isInteractiveTerminal} from './tty.js'

export type CliInvocation =
  {readonly args: readonly string[]; readonly kind: 'oclif'} | {readonly kind: 'dashboard'}

export interface RunCliOptions {
  readonly args?: readonly string[]
  readonly development?: boolean
  readonly dir: string | URL
  readonly stderr?: NodeJS.WriteStream
  readonly stdin?: NodeJS.ReadStream
  readonly stdout?: NodeJS.WriteStream
}

function configPath(dir: string | URL): string {
  if (dir instanceof URL) return fileURLToPath(dir)
  return dir.startsWith('file://') ? fileURLToPath(dir) : dir
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

export function resolveCliInvocation(
  args: readonly string[],
  interactiveTerminal: boolean,
): CliInvocation {
  if (args.length === 0) {
    return interactiveTerminal ? {kind: 'dashboard'} : {args: ['--help'], kind: 'oclif'}
  }

  if (args.length === 1 && args[0] === '--no-interactive') {
    return {args: ['--help'], kind: 'oclif'}
  }

  return {args, kind: 'oclif'}
}

async function runDashboard({
  development,
  dir,
  stderr,
  stdin,
  stdout,
}: Required<Pick<RunCliOptions, 'development' | 'stderr' | 'stdin' | 'stdout'>> &
  Pick<RunCliOptions, 'dir'>): Promise<void> {
  if (development) {
    process.env.NODE_ENV = 'development'
    settings.debug = true
  }

  let config: Config
  try {
    config = await Config.load(configPath(dir))
  } catch (error: unknown) {
    await handle(asError(error))
    return
  }

  let lifecycleError: Error | undefined

  try {
    await config.runHook('init', {argv: [], id: undefined})
  } catch (error: unknown) {
    lifecycleError = asError(error)
  }

  if (!lifecycleError) {
    try {
      const [{createApplicationServices}, {renderTui}] = await Promise.all([
        import('./container.js'),
        import('./render-tui.js'),
      ])
      const exitCode = await renderTui({
        cwd: process.cwd(),
        initialRoute: 'home',
        name: config.bin,
        services: createApplicationServices(),
        stderr,
        stdin,
        stdout,
        version: config.version,
      })
      if (exitCode !== 0) process.exitCode = exitCode
    } catch (error: unknown) {
      lifecycleError = asError(error)
    }
  }

  try {
    await config.runHook('finally', {
      argv: [],
      Command: undefined,
      error: lifecycleError,
      id: '',
    })
  } catch (error: unknown) {
    lifecycleError ??= asError(error)
  }

  if (lifecycleError) {
    await handle(lifecycleError)
    return
  }

  try {
    await flush()
  } catch (error: unknown) {
    await handle(asError(error))
  }
}

export async function runCli({
  args = process.argv.slice(2),
  development = false,
  dir,
  stderr = process.stderr,
  stdin = process.stdin,
  stdout = process.stdout,
}: RunCliOptions): Promise<void> {
  const invocation = resolveCliInvocation(args, isInteractiveTerminal({stdin, stdout}))
  if (invocation.kind === 'oclif') {
    await execute({args: [...invocation.args], development, dir: String(dir)})
    return
  }

  await runDashboard({development, dir, stderr, stdin, stdout})
}
