import {stripVTControlCharacters} from 'node:util'

import {Command, Flags, type Interfaces} from '@oclif/core'

import {TaskNotFoundError} from '@/features/tasks/index.js'
import {InvalidPackageJsonError, WorkspaceNotFoundError} from '@/features/workspace/index.js'
import {presentJson} from '@/presenters/json/serialize.js'

import {isInteractiveTerminal} from './tty.js'

export const interactiveFlag = Flags.boolean({
  char: 'i',
  description: 'Open the command-specific interactive screen.',
})

function messageFor(error: unknown): string {
  const message = error instanceof Error ? error.message : 'An unexpected error occurred.'
  return stripVTControlCharacters(message).replaceAll(/\p{Cc}+/gu, ' ')
}

function propertyFrom(error: unknown, key: string): unknown {
  if ((typeof error !== 'object' || error === null) && typeof error !== 'function') {
    return undefined
  }

  return Reflect.get(error, key)
}

function configuredExitCode(error: unknown): number | undefined {
  const directExitCode = propertyFrom(error, 'exitCode')
  if (typeof directExitCode === 'number') return directExitCode

  const metadata = propertyFrom(error, 'oclif')
  if (typeof metadata !== 'object' || metadata === null) return undefined

  const exitCode = Reflect.get(metadata, 'exit') as unknown
  return typeof exitCode === 'number' ? exitCode : undefined
}

function codeFor(error: unknown): string | undefined {
  const code = propertyFrom(error, 'code')
  return typeof code === 'string' && code.length > 0 ? code : undefined
}

function suggestionsFor(error: unknown): readonly string[] | undefined {
  const suggestions = propertyFrom(error, 'suggestions')
  if (!Array.isArray(suggestions)) return undefined

  const strings = suggestions.filter(
    (suggestion): suggestion is string => typeof suggestion === 'string',
  )
  return strings.length > 0 ? strings : undefined
}

export abstract class BaseCommand extends Command {
  static override enableJsonFlag = true

  protected override catch(error: Interfaces.CommandError): Promise<unknown> {
    // oclif v4 stores explicit `this.error(..., {exit})` values in metadata,
    // while its JSON catch path reads `exitCode`. Bridge both representations.
    const exitCode = configuredExitCode(error)
    if (exitCode !== undefined) process.exitCode = exitCode
    return super.catch(error) as Promise<unknown>
  }

  protected override toSuccessJson(result: unknown): unknown {
    // oclif owns the single JSON write; the shared serializer guarantees that
    // subprocess output and workspace metadata cannot leak ANSI sequences.
    return JSON.parse(presentJson(result)) as unknown
  }

  protected override toErrorJson(error: unknown): unknown {
    const code = codeFor(error)
    const suggestions = suggestionsFor(error)
    const envelope = {
      error: {
        ...(code === undefined ? {} : {code}),
        exitCode: configuredExitCode(error) ?? 1,
        message: messageFor(error),
        ...(suggestions === undefined ? {} : {suggestions}),
      },
    }

    return JSON.parse(presentJson(envelope)) as unknown
  }

  protected assertOutputMode(interactive: boolean | undefined): void {
    if (interactive && this.jsonEnabled()) {
      this.error('--interactive and --json cannot be used together.', {exit: 2})
    }

    if (interactive && !isInteractiveTerminal()) {
      this.error('--interactive requires stdin and stdout to be attached to a TTY.', {
        exit: 2,
        suggestions: [
          'Remove --interactive to use textual output.',
          'Use --json in scripts and CI.',
        ],
      })
    }
  }

  protected fail(error: unknown): never {
    if (error instanceof TaskNotFoundError) {
      this.error(messageFor(error), {
        code: error.code,
        exit: 2,
        suggestions: ['Run "mycli task list" to inspect scripts in this workspace.'],
      })
    }

    if (error instanceof WorkspaceNotFoundError) {
      this.error(messageFor(error), {
        code: error.code,
        exit: 1,
        suggestions: ['Run the command from a directory that contains package.json.'],
      })
    }

    if (error instanceof InvalidPackageJsonError) {
      this.error(messageFor(error), {
        code: error.code,
        exit: 1,
        suggestions: ['Repair package.json and run the command again.'],
      })
    }

    this.error(messageFor(error), {exit: 1})
  }
}
